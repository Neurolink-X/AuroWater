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

-- Per-supplier settings match the platform cap, including future parallel offer
-- logic. The previous optional migration used a 15-order default.
ALTER TABLE public.supplier_settings
  ADD COLUMN IF NOT EXISTS max_active_orders integer NOT NULL DEFAULT 20;
ALTER TABLE public.supplier_settings
  ALTER COLUMN max_active_orders SET DEFAULT 20;
UPDATE public.supplier_settings SET max_active_orders=20
WHERE max_active_orders IS DISTINCT FROM 20;

-- Defense in depth: even manual assignments and future RPCs cannot exceed 20.
-- Locking the supplier row also serializes admissions across different orders.
CREATE OR REPLACE FUNCTION public.guard_supplier_active_capacity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
DECLARE v_used integer; v_max integer;
BEGIN
  IF NEW.supplier_id IS NULL OR NEW.status NOT IN ('ASSIGNED','IN_PROGRESS') THEN
    RETURN NEW;
  END IF;
  IF OLD.supplier_id IS NOT DISTINCT FROM NEW.supplier_id
     AND OLD.status IN ('ASSIGNED','IN_PROGRESS') THEN RETURN NEW; END IF;
  SELECT max_active_orders INTO v_max FROM public.supplier_settings
  WHERE user_id=NEW.supplier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLIER_SETTINGS_MISSING' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO v_used FROM public.orders
  WHERE supplier_id=NEW.supplier_id AND status IN ('ASSIGNED','IN_PROGRESS')
    AND id<>NEW.id;
  IF v_used >= least(20,coalesce(v_max,20)) THEN
    RAISE EXCEPTION 'SUPPLIER_AT_CAPACITY' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS supplier_order_active_capacity_guard ON public.orders;
CREATE TRIGGER supplier_order_active_capacity_guard
  BEFORE UPDATE OF supplier_id,status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_active_capacity();
REVOKE ALL ON FUNCTION public.guard_supplier_active_capacity() FROM PUBLIC, anon, authenticated;

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

-- No failed supplier search should hold a scheduled worker forever. Five
-- unsuccessful searches mean human review; only admin-confirmed rescheduling
-- resets the operational failure metadata.
CREATE OR REPLACE FUNCTION public.claim_dispatch_retry(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $function$
DECLARE claimed uuid;
BEGIN
  IF p_order_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id=p_order_id AND status='PENDING' AND supplier_id IS NULL
  ) THEN RETURN false; END IF;
  INSERT INTO public.dispatch_retry_state AS s (order_id,next_retry_at,updated_at)
  VALUES(p_order_id,clock_timestamp()+interval '2 minutes',clock_timestamp())
  ON CONFLICT(order_id) DO UPDATE
    SET next_retry_at=EXCLUDED.next_retry_at, updated_at=clock_timestamp()
    WHERE s.failures < 5 AND s.next_retry_at <= clock_timestamp()
  RETURNING order_id INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_dispatch_retry(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dispatch_retry(uuid) TO service_role;

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

  UPDATE public.orders SET scheduled_at=p_scheduled_at,updated_at=clock_timestamp(),
    dispatch_attempts=0,last_dispatch_at=NULL WHERE id=p_order_id;
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
