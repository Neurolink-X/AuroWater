-- AuroWater: atomic supplier stock reservation + deterministic geo dispatch
-- Safe/idempotent. Apply after existing migrations. Re-run is safe.

BEGIN;

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='addresses_lat_valid' AND conrelid='public.addresses'::regclass) THEN
    ALTER TABLE public.addresses ADD CONSTRAINT addresses_lat_valid CHECK (lat IS NULL OR lat BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='addresses_lng_valid' AND conrelid='public.addresses'::regclass) THEN
    ALTER TABLE public.addresses ADD CONSTRAINT addresses_lng_valid CHECK (lng IS NULL OR lng BETWEEN -180 AND 180);
  END IF;
END $$;

ALTER TABLE public.supplier_settings
  ADD COLUMN IF NOT EXISTS base_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS base_lng DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='supplier_settings_base_lat_valid' AND conrelid='public.supplier_settings'::regclass) THEN
    ALTER TABLE public.supplier_settings ADD CONSTRAINT supplier_settings_base_lat_valid CHECK (base_lat IS NULL OR base_lat BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='supplier_settings_base_lng_valid' AND conrelid='public.supplier_settings'::regclass) THEN
    ALTER TABLE public.supplier_settings ADD CONSTRAINT supplier_settings_base_lng_valid CHECK (base_lng IS NULL OR base_lng BETWEEN -180 AND 180);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.order_dispatch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status IN ('ASSIGNED','ACCEPTED','REJECTED','EXPIRED','CANCELLED')),
  distance_km NUMERIC(10,2),
  responded_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_dispatch_order_created ON public.order_dispatch(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_dispatch_supplier_status ON public.order_dispatch(supplier_id, status);
ALTER TABLE public.order_dispatch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_dispatch_supplier_read ON public.order_dispatch;
CREATE POLICY order_dispatch_supplier_read ON public.order_dispatch FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());

DROP POLICY IF EXISTS order_dispatch_customer_read ON public.order_dispatch;
CREATE POLICY order_dispatch_customer_read ON public.order_dispatch FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_dispatch.order_id AND o.customer_id = auth.uid()));

DROP POLICY IF EXISTS order_dispatch_admin_all ON public.order_dispatch;
CREATE POLICY order_dispatch_admin_all ON public.order_dispatch FOR ALL TO authenticated
  USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

ALTER TABLE public.supplier_stock
  ADD COLUMN IF NOT EXISTS reserved_cans INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reservation_buffer_cans INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_stock DROP CONSTRAINT IF EXISTS supplier_stock_available_valid;
ALTER TABLE public.supplier_stock DROP CONSTRAINT IF EXISTS supplier_stock_reserved_valid;
ALTER TABLE public.supplier_stock DROP CONSTRAINT IF EXISTS supplier_stock_buffer_valid;
ALTER TABLE public.supplier_stock
  ADD CONSTRAINT supplier_stock_available_valid CHECK (cans_available >= 0),
  ADD CONSTRAINT supplier_stock_reserved_valid CHECK (reserved_cans >= 0 AND reserved_cans <= cans_available),
  ADD CONSTRAINT supplier_stock_buffer_valid CHECK (reservation_buffer_cans >= 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_reserved_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_reservation_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stock_reserved_supplier_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS stock_reserved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stock_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stock_consumed_at TIMESTAMPTZ;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_stock_reservation_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_stock_reserved_quantity_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_stock_reservation_status_check CHECK (stock_reservation_status IN ('none','reserved','released','consumed')),
  ADD CONSTRAINT orders_stock_reserved_quantity_check CHECK (stock_reserved_quantity >= 0);
CREATE INDEX IF NOT EXISTS idx_orders_stock_reservation ON public.orders(stock_reservation_status, stock_reserved_supplier_id);

-- Remove the old non-atomic completion trigger from PATCH_001.
DROP TRIGGER IF EXISTS trg_deduct_stock ON public.orders;
DROP FUNCTION IF EXISTS public.deduct_supplier_stock();

CREATE OR REPLACE FUNCTION public.adjust_supplier_stock(
  p_supplier_id UUID,
  p_delta INTEGER,
  p_low_stock_alert INTEGER DEFAULT NULL,
  p_reservation_buffer_cans INTEGER DEFAULT NULL
) RETURNS public.supplier_stock
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.supplier_stock; next_available INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_supplier_id AND public.current_profile_role() <> 'admin' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_delta IS NULL OR p_delta < -100000 OR p_delta > 100000 THEN RAISE EXCEPTION 'INVALID_STOCK_ADJUSTMENT'; END IF;
  INSERT INTO public.supplier_stock(supplier_id) VALUES(p_supplier_id) ON CONFLICT(supplier_id) DO NOTHING;
  SELECT * INTO r FROM public.supplier_stock WHERE supplier_id=p_supplier_id FOR UPDATE;
  next_available := r.cans_available + p_delta;
  IF next_available < r.reserved_cans THEN RAISE EXCEPTION 'STOCK_BELOW_RESERVED'; END IF;
  UPDATE public.supplier_stock
    SET cans_available=next_available,
        low_stock_alert=COALESCE(p_low_stock_alert,low_stock_alert),
        reservation_buffer_cans=COALESCE(p_reservation_buffer_cans,reservation_buffer_cans),
        updated_at=now()
    WHERE supplier_id=p_supplier_id RETURNING * INTO r;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.set_supplier_stock(
  p_supplier_id UUID,
  p_cans_available INTEGER,
  p_low_stock_alert INTEGER DEFAULT NULL,
  p_reservation_buffer_cans INTEGER DEFAULT NULL
) RETURNS public.supplier_stock
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.supplier_stock;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_supplier_id AND public.current_profile_role() <> 'admin' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_cans_available IS NULL OR p_cans_available < 0 OR p_cans_available > 100000 THEN RAISE EXCEPTION 'INVALID_STOCK'; END IF;
  INSERT INTO public.supplier_stock(supplier_id) VALUES(p_supplier_id) ON CONFLICT(supplier_id) DO NOTHING;
  SELECT * INTO r FROM public.supplier_stock WHERE supplier_id=p_supplier_id FOR UPDATE;
  IF p_cans_available < r.reserved_cans THEN RAISE EXCEPTION 'STOCK_BELOW_RESERVED'; END IF;
  UPDATE public.supplier_stock
    SET cans_available=p_cans_available,
        low_stock_alert=COALESCE(p_low_stock_alert,low_stock_alert),
        reservation_buffer_cans=COALESCE(p_reservation_buffer_cans,reservation_buffer_cans),
        updated_at=now()
    WHERE supplier_id=p_supplier_id RETURNING * INTO r;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.try_assign_supplier_with_stock(
  p_order_id UUID,
  p_supplier_id UUID,
  p_distance_km NUMERIC DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; s public.supplier_stock; qty INTEGER; now_ts TIMESTAMPTZ:=now();
BEGIN
  IF auth.role() <> 'service_role' AND public.current_profile_role() <> 'admin' AND auth.uid() IS DISTINCT FROM p_supplier_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'PENDING' OR o.supplier_id IS NOT NULL THEN RETURN FALSE; END IF;
  qty:=GREATEST(0,COALESCE(o.can_count,0));
  IF qty <= 0 THEN
    INSERT INTO public.order_dispatch(order_id,supplier_id,status,distance_km,created_at) VALUES(p_order_id,p_supplier_id,'ASSIGNED',p_distance_km,now_ts);
    UPDATE public.orders SET supplier_id=p_supplier_id,status='ASSIGNED',assigned_at=now_ts,last_dispatch_at=now_ts,dispatch_attempts=COALESCE(dispatch_attempts,0)+1 WHERE id=p_order_id;
    RETURN TRUE;
  END IF;
  SELECT * INTO s FROM public.supplier_stock WHERE supplier_id=p_supplier_id FOR UPDATE;
  IF NOT FOUND OR s.cans_available-s.reserved_cans-s.reservation_buffer_cans < qty THEN RETURN FALSE; END IF;
  INSERT INTO public.order_dispatch(order_id,supplier_id,status,distance_km,created_at) VALUES(p_order_id,p_supplier_id,'ASSIGNED',p_distance_km,now_ts);
  UPDATE public.supplier_stock SET reserved_cans=reserved_cans+qty,updated_at=now_ts WHERE supplier_id=p_supplier_id;
  UPDATE public.orders SET supplier_id=p_supplier_id,status='ASSIGNED',assigned_at=now_ts,last_dispatch_at=now_ts,
    dispatch_attempts=COALESCE(dispatch_attempts,0)+1,stock_reserved_quantity=qty,stock_reservation_status='reserved',
    stock_reserved_supplier_id=p_supplier_id,stock_reserved_at=now_ts,stock_released_at=NULL,stock_consumed_at=NULL
    WHERE id=p_order_id;
  RETURN TRUE;
EXCEPTION WHEN unique_violation THEN RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_order_stock_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE supplier UUID; qty INTEGER;
BEGIN
  IF OLD.stock_reservation_status <> 'reserved' OR OLD.stock_reserved_quantity <= 0 OR OLD.stock_reserved_supplier_id IS NULL THEN RETURN NEW; END IF;
  supplier:=OLD.stock_reserved_supplier_id; qty:=OLD.stock_reserved_quantity;
  IF NEW.status='COMPLETED' AND OLD.status<>'COMPLETED' THEN
    UPDATE public.supplier_stock SET cans_available=GREATEST(0,cans_available-qty),reserved_cans=GREATEST(0,reserved_cans-qty),updated_at=now() WHERE supplier_id=supplier;
    NEW.stock_reservation_status:='consumed'; NEW.stock_consumed_at:=now(); NEW.stock_reserved_quantity:=0;
    RETURN NEW;
  END IF;
  IF NEW.status='CANCELLED' OR (NEW.status='PENDING' AND NEW.supplier_id IS NULL AND OLD.supplier_id IS NOT NULL) THEN
    UPDATE public.supplier_stock SET reserved_cans=GREATEST(0,reserved_cans-qty),updated_at=now() WHERE supplier_id=supplier;
    NEW.stock_reservation_status:='released'; NEW.stock_released_at:=now(); NEW.stock_reserved_quantity:=0; NEW.stock_reserved_supplier_id:=NULL;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_order_stock_reservation ON public.orders;
CREATE TRIGGER trg_sync_order_stock_reservation BEFORE UPDATE OF status,supplier_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_stock_reservation();

GRANT EXECUTE ON FUNCTION public.adjust_supplier_stock(UUID,INTEGER,INTEGER,INTEGER) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_supplier_stock(UUID,INTEGER,INTEGER,INTEGER) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.try_assign_supplier_with_stock(UUID,UUID,NUMERIC) TO authenticated,service_role;

COMMIT;
SELECT pg_notify('pgrst','reload schema');
