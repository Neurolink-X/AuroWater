-- Dispatch operational guardrails: safe 20-order cap and deduplicated escalation.
-- Additive: never touches existing orders, customer payments, or payout ledger.
BEGIN;

CREATE TABLE IF NOT EXISTS public.dispatch_alert_events (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, action)
);
ALTER TABLE public.dispatch_alert_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dispatch_alert_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.dispatch_alert_events TO service_role;

-- Keep the original stock reservation, order locking and authorization rules;
-- lock supplier settings across competing orders to prevent capacity oversubscription.
CREATE OR REPLACE FUNCTION public.try_assign_supplier_with_stock(
  p_order_id uuid, p_supplier_id uuid, p_distance_km numeric DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_order public.orders;
  v_stock public.supplier_stock;
  v_qty integer;
  v_now timestamptz := now();
  v_active integer;
  v_cap integer;
  v_online boolean;
BEGIN
  IF auth.role() <> 'service_role'
     AND public.current_profile_role() <> 'admin'
     AND auth.uid() IS DISTINCT FROM p_supplier_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'PENDING' OR v_order.supplier_id IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Serialize capacity checks per supplier so two pending orders cannot both
  -- claim the last available slot in separate transactions.
  SELECT s.is_online INTO v_online
  FROM public.supplier_settings s
  WHERE s.user_id = p_supplier_id FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(v_online, false) THEN RETURN false; END IF;

  SELECT greatest(1,least(20,coalesce(nullif(value,'')::integer,20)))
    INTO v_cap FROM public.settings WHERE key='supplier_max_active_orders';
  v_cap := coalesce(v_cap,20);
  SELECT count(*) INTO v_active FROM public.orders
  WHERE supplier_id=p_supplier_id AND status IN ('ASSIGNED','IN_PROGRESS');
  IF v_active >= v_cap THEN RETURN false; END IF;

  v_qty := greatest(0,coalesce(v_order.can_count,0));
  IF v_qty <= 0 THEN
    INSERT INTO public.order_dispatch(order_id,supplier_id,status,distance_km,created_at)
    VALUES(p_order_id,p_supplier_id,'ASSIGNED',p_distance_km,v_now);
    UPDATE public.orders SET supplier_id=p_supplier_id, status='ASSIGNED',
      assigned_at=v_now,last_dispatch_at=v_now,
      dispatch_attempts=coalesce(dispatch_attempts,0)+1
    WHERE id=p_order_id;
    RETURN true;
  END IF;

  SELECT * INTO v_stock FROM public.supplier_stock
  WHERE supplier_id=p_supplier_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF (v_stock.cans_available-v_stock.reserved_cans-v_stock.reservation_buffer_cans) < v_qty
  THEN RETURN false; END IF;

  INSERT INTO public.order_dispatch(order_id,supplier_id,status,distance_km,created_at)
  VALUES(p_order_id,p_supplier_id,'ASSIGNED',p_distance_km,v_now);
  UPDATE public.supplier_stock
  SET reserved_cans=reserved_cans+v_qty,updated_at=v_now WHERE supplier_id=p_supplier_id;
  UPDATE public.orders SET supplier_id=p_supplier_id,status='ASSIGNED',
    assigned_at=v_now,last_dispatch_at=v_now,
    dispatch_attempts=coalesce(dispatch_attempts,0)+1,
    stock_reserved_quantity=v_qty,stock_reservation_status='reserved',
    stock_reserved_supplier_id=p_supplier_id,stock_reserved_at=v_now,
    stock_released_at=NULL,stock_consumed_at=NULL
  WHERE id=p_order_id;
  RETURN true;
EXCEPTION WHEN unique_violation THEN RETURN false;
END;
$function$;

-- Keep previous RPC exposure exactly as designed; invocation is authorization-checked.
GRANT EXECUTE ON FUNCTION public.try_assign_supplier_with_stock(uuid,uuid,numeric) TO authenticated, service_role;
-- Twenty is a hard cap by policy; existing assignments remain untouched.
INSERT INTO public.settings(key,value)
VALUES('supplier_max_active_orders','20')
ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now();

-- Admin-only, auditable, all-or-nothing recovery after customer slot confirmation.
-- This is not callable by browser roles, and does not assign a supplier itself.
CREATE OR REPLACE FUNCTION public.reconfirm_pending_dispatch_slot(
  p_order_id uuid, p_scheduled_at timestamptz, p_admin_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $function$
DECLARE
  v_order public.orders;
BEGIN
  IF p_order_id IS NULL OR p_admin_id IS NULL OR p_scheduled_at IS NULL
    OR p_scheduled_at < clock_timestamp() + interval '5 minutes'
    OR p_scheduled_at > clock_timestamp() + interval '30 days' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND status='PENDING' AND supplier_id IS NULL
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.orders SET scheduled_at=p_scheduled_at,updated_at=clock_timestamp()
    WHERE id=p_order_id;
  DELETE FROM public.dispatch_retry_state WHERE order_id=p_order_id;
  DELETE FROM public.dispatch_alert_events WHERE order_id=p_order_id
    AND action IN ('manual_dispatch_review','stale_schedule_review','no_supplier');

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, meta)
  VALUES(p_admin_id,'order.slot_reconfirmed','orders',p_order_id::text,
     jsonb_build_object('old_schedule',v_order.scheduled_at,'new_schedule',p_scheduled_at,
     'requires_new_dispatch_attempt',true,'customer_confirmation_claimed',true));

  INSERT INTO public.notifications(user_id,type,title,message,data,is_read,dedup_key)
  VALUES(v_order.customer_id,'booking','Delivery time updated',
    'AuroTap admin confirmed a revised delivery time. Supplier assignment is still in progress.',
    jsonb_build_object('order_id',p_order_id),false,
    'order_'||p_order_id::text||'_slot_'||to_char(p_scheduled_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS'))
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.reconfirm_pending_dispatch_slot(uuid,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconfirm_pending_dispatch_slot(uuid,timestamptz,uuid) TO service_role;

COMMIT;
