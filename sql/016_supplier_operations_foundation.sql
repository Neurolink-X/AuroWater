-- 016_supplier_operations_foundation.sql
-- AuroWater production schema alignment:
-- service zones, supplier-zone mapping, dispatch attempt ledger,
-- address/order compatibility fields, payment compatibility,
-- immutable supplier payout snapshots, and atomic payout-request creation.
-- Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS public.service_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city          TEXT NOT NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'COMING_SOON'
                  CHECK (status IN ('AVAILABLE','LIMITED','TEMPORARILY_UNAVAILABLE','COMING_SOON')),
  pincodes      TEXT[] NOT NULL DEFAULT '{}',
  center_lat    NUMERIC(9,6),
  center_lng    NUMERIC(9,6),
  radius_km     NUMERIC(8,2),
  services      TEXT[],
  is_catch_all  BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_zones_city_status_idx
  ON public.service_zones(city, status);
CREATE INDEX IF NOT EXISTS service_zones_pincode_gin_idx
  ON public.service_zones USING GIN(pincodes);

ALTER TABLE public.service_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_zones_select_admin" ON public.service_zones;
CREATE POLICY "service_zones_select_admin" ON public.service_zones
  FOR SELECT USING (COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "service_zones_write_admin" ON public.service_zones;
CREATE POLICY "service_zones_write_admin" ON public.service_zones
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP TRIGGER IF EXISTS service_zones_updated_at ON public.service_zones;
CREATE TRIGGER service_zones_updated_at
  BEFORE UPDATE ON public.service_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.supplier_zones (
  supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id     UUID NOT NULL REFERENCES public.service_zones(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (supplier_id, zone_id)
);

CREATE INDEX IF NOT EXISTS supplier_zones_zone_supplier_idx
  ON public.supplier_zones(zone_id, supplier_id);

ALTER TABLE public.supplier_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_zones_select_own_or_admin" ON public.supplier_zones;
CREATE POLICY "supplier_zones_select_own_or_admin" ON public.supplier_zones
  FOR SELECT USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_zones_admin_write" ON public.supplier_zones;
CREATE POLICY "supplier_zones_admin_write" ON public.supplier_zones
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

CREATE TABLE IF NOT EXISTS public.order_dispatch (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'ASSIGNED'
                  CHECK (status IN ('ASSIGNED','ACCEPTED','REJECTED','EXPIRED','CANCELLED')),
  attempt_no    INTEGER NOT NULL DEFAULT 1 CHECK (attempt_no > 0),
  distance_km   NUMERIC(8,2),
  reason        TEXT,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS order_dispatch_order_status_idx
  ON public.order_dispatch(order_id, status);
CREATE INDEX IF NOT EXISTS order_dispatch_supplier_status_idx
  ON public.order_dispatch(supplier_id, status);

ALTER TABLE public.order_dispatch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_dispatch_select_own_or_admin" ON public.order_dispatch;
CREATE POLICY "order_dispatch_select_own_or_admin" ON public.order_dispatch
  FOR SELECT USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "order_dispatch_admin_write" ON public.order_dispatch;
CREATE POLICY "order_dispatch_admin_write" ON public.order_dispatch
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP TRIGGER IF EXISTS order_dispatch_updated_at ON public.order_dispatch;
CREATE TRIGGER order_dispatch_updated_at
  BEFORE UPDATE ON public.order_dispatch
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Supplier can create its own settings row on first login; admin retains full access.
DROP POLICY IF EXISTS "supplier_settings_insert_admin" ON public.supplier_settings;
DROP POLICY IF EXISTS "supplier_settings_insert_own_or_admin" ON public.supplier_settings;
CREATE POLICY "supplier_settings_insert_own_or_admin" ON public.supplier_settings
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS line1 TEXT,
  ADD COLUMN IF NOT EXISTS line2 TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.service_zones(id);

UPDATE public.addresses
SET
  customer_id = COALESCE(customer_id, user_id),
  line1 = COALESCE(line1, house_flat),
  line2 = COALESCE(line2, area),
  state = COALESCE(NULLIF(TRIM(state), ''), 'Uttar Pradesh')
WHERE customer_id IS NULL
   OR line1 IS NULL
   OR line2 IS NULL
   OR state IS NULL
   OR TRIM(state) = '';

CREATE INDEX IF NOT EXISTS addresses_customer_created_idx
  ON public.addresses(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS addresses_zone_idx
  ON public.addresses(zone_id);

CREATE OR REPLACE FUNCTION public.sync_address_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := NEW.user_id;
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.customer_id;
  END IF;
  IF NEW.line1 IS NULL OR TRIM(NEW.line1) = '' THEN
    NEW.line1 := NEW.house_flat;
  END IF;
  IF NEW.line2 IS NULL OR TRIM(NEW.line2) = '' THEN
    NEW.line2 := NEW.area;
  END IF;
  IF NEW.house_flat IS NULL OR TRIM(NEW.house_flat) = '' THEN
    NEW.house_flat := NEW.line1;
  END IF;
  IF NEW.area IS NULL OR TRIM(NEW.area) = '' THEN
    NEW.area := NEW.line2;
  END IF;
  IF NEW.state IS NULL OR TRIM(NEW.state) = '' THEN
    NEW.state := 'Uttar Pradesh';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS addresses_sync_contract ON public.addresses;
CREATE TRIGGER addresses_sync_contract
  BEFORE INSERT OR UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.sync_address_contract();

DROP POLICY IF EXISTS "addresses_insert_customer_or_admin" ON public.addresses;
CREATE POLICY "addresses_insert_customer_or_admin" ON public.addresses
  FOR INSERT WITH CHECK (
    customer_id = auth.uid()
    OR user_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.service_zones(id),
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS subscription_id UUID,
  ADD COLUMN IF NOT EXISTS can_count INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_attempts INTEGER NOT NULL DEFAULT 0 CHECK (dispatch_attempts >= 0),
  ADD COLUMN IF NOT EXISTS last_dispatch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplier_note TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS review_text TEXT,
  ADD COLUMN IF NOT EXISTS otp TEXT,
  ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS has_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_payout_rate_snapshot NUMERIC(6,2) NOT NULL DEFAULT 0;

UPDATE public.orders o
SET
  service_type = COALESCE(o.service_type, st.key),
  final_amount = COALESCE(o.final_amount, o.total_amount),
  can_count = COALESCE(o.can_count, o.can_quantity),
  note = COALESCE(o.note, o.notes)
FROM public.service_types st
WHERE st.id = o.service_type_id
  AND (
    o.service_type IS NULL
    OR o.final_amount IS NULL
    OR o.can_count IS NULL
    OR o.note IS NULL
  );

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check_v2
  CHECK (payment_status IN ('pending','unpaid','paid','refunded','failed'));

CREATE OR REPLACE FUNCTION public.sync_order_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  resolved_service_id INTEGER;
  resolved_service_key TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.service_type IS DISTINCT FROM OLD.service_type THEN
    IF NEW.service_type IS NOT NULL AND TRIM(NEW.service_type) <> '' THEN
      SELECT id, key
      INTO resolved_service_id, resolved_service_key
      FROM public.service_types
      WHERE key = NEW.service_type
        AND is_active = true
      LIMIT 1;
      IF resolved_service_id IS NOT NULL THEN
        NEW.service_type_id := resolved_service_id;
        NEW.service_type := resolved_service_key;
      END IF;
    END IF;
  END IF;

  IF NEW.service_type IS NULL AND NEW.service_type_id IS NOT NULL THEN
    SELECT key INTO NEW.service_type
    FROM public.service_types
    WHERE id = NEW.service_type_id
    LIMIT 1;
  END IF;

  IF NEW.can_count IS NULL AND NEW.can_quantity IS NOT NULL THEN
    NEW.can_count := NEW.can_quantity;
  END IF;

  IF NEW.can_quantity IS NULL AND NEW.can_count IS NOT NULL THEN
    NEW.can_quantity := NEW.can_count;
  END IF;

  IF NEW.final_amount IS NULL THEN
    NEW.final_amount := NEW.total_amount;
  END IF;

  IF NEW.note IS NULL THEN
    NEW.note := NEW.notes;
  END IF;

  IF NEW.notes IS NULL THEN
    NEW.notes := NEW.note;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_sync_contract ON public.orders;
CREATE TRIGGER orders_sync_contract
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_contract();

CREATE OR REPLACE FUNCTION public.snapshot_supplier_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  configured_pct NUMERIC(6,2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT NULLIF(regexp_replace(value, '[^0-9.\-]', '', 'g'), '')::NUMERIC
    INTO configured_pct
    FROM public.settings
    WHERE key = 'supplier_commission'
    LIMIT 1;

    configured_pct := GREATEST(0, LEAST(100, COALESCE(configured_pct, 30)));
    NEW.supplier_payout_rate_snapshot := configured_pct;

    IF COALESCE(NEW.supplier_payout, 0) = 0
       AND COALESCE(NEW.total_amount, 0) > 0 THEN
      NEW.supplier_payout :=
        ROUND((NEW.total_amount * configured_pct / 100.0)::NUMERIC, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_supplier_payout_snapshot ON public.orders;
CREATE TRIGGER orders_supplier_payout_snapshot
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_supplier_payout();

DO $$
DECLARE
  pct NUMERIC(6,2);
BEGIN
  SELECT GREATEST(0, LEAST(100, COALESCE(
    NULLIF(regexp_replace(value, '[^0-9.\-]', '', 'g'), '')::NUMERIC,
    30
  ))) INTO pct
  FROM public.settings
  WHERE key = 'supplier_commission'
  LIMIT 1;

  pct := COALESCE(pct, 30);

  UPDATE public.orders
  SET supplier_payout_rate_snapshot = pct,
      supplier_payout = ROUND((total_amount * pct / 100.0)::NUMERIC, 2)
  WHERE status IN ('PENDING','ASSIGNED','IN_PROGRESS')
    AND COALESCE(supplier_payout, 0) = 0
    AND total_amount > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_payout_request(
  p_supplier_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_destination_reference TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_id UUID;
  eligible NUMERIC(12,2);
  already_requested NUMERIC(12,2);
  available NUMERIC(12,2);
  inserted_request public.payout_requests%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;
  IF p_method NOT IN ('upi','bank') THEN
    RAISE EXCEPTION 'INVALID_METHOD';
  END IF;

  SELECT id INTO locked_id
  FROM public.profiles
  WHERE id = p_supplier_id
    AND role = 'supplier'
  FOR UPDATE;

  IF locked_id IS NULL THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(supplier_payout), 0)
  INTO eligible
  FROM public.orders
  WHERE supplier_id = p_supplier_id
    AND status = 'COMPLETED'
    AND payout_status = 'pending';

  SELECT COALESCE(SUM(amount), 0)
  INTO already_requested
  FROM public.payout_requests
  WHERE supplier_id = p_supplier_id
    AND status IN ('pending','processing');

  available := GREATEST(0, ROUND((eligible - already_requested)::NUMERIC, 2));

  IF p_amount > available THEN
    RAISE EXCEPTION 'PAYOUT_BALANCE_EXCEEDED:%', available;
  END IF;

  INSERT INTO public.payout_requests (
    supplier_id, amount, method, destination_reference, status, notes
  )
  VALUES (
    p_supplier_id,
    ROUND(p_amount::NUMERIC, 2),
    p_method,
    NULLIF(TRIM(p_destination_reference), ''),
    'pending',
    NULLIF(TRIM(p_notes), '')
  )
  RETURNING * INTO inserted_request;

  RETURN jsonb_build_object(
    'id', inserted_request.id,
    'supplier_id', inserted_request.supplier_id,
    'amount', inserted_request.amount,
    'method', inserted_request.method,
    'status', inserted_request.status,
    'destination_reference', inserted_request.destination_reference,
    'notes', inserted_request.notes,
    'created_at', inserted_request.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_supplier_payout_request(UUID, NUMERIC, TEXT, TEXT, TEXT)
  TO service_role;


-- Supplier dashboard earnings contract:
--   gross_amount = supplier earnings for the requested reporting period.
--   pending_payout = globally available completed supplier earnings after
--   subtracting payout requests already pending/processing.
CREATE OR REPLACE FUNCTION public.get_supplier_earnings(p_supplier_id UUID, p_period TEXT)
RETURNS TABLE (
  period_label TEXT,
  order_count BIGINT,
  gross_amount NUMERIC,
  pending_payout NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  start_ts TIMESTAMPTZ;
  pl TEXT;
BEGIN
  pl := lower(coalesce(p_period, 'month'));
  start_ts := CASE pl
    WHEN 'today' THEN date_trunc('day', NOW())
    WHEN 'week' THEN date_trunc('week', NOW())
    WHEN 'month' THEN date_trunc('month', NOW())
    ELSE date_trunc('month', NOW())
  END;

  RETURN QUERY
  SELECT
    pl::TEXT,
    COUNT(*) FILTER (WHERE o.status = 'COMPLETED')::BIGINT,
    COALESCE(SUM(o.supplier_payout) FILTER (WHERE o.status = 'COMPLETED'), 0)::NUMERIC,
    GREATEST(
      0,
      ROUND((
        COALESCE((
          SELECT SUM(o2.supplier_payout)
          FROM public.orders o2
          WHERE o2.supplier_id = p_supplier_id
            AND o2.status = 'COMPLETED'
            AND o2.payout_status = 'pending'
        ), 0)
        -
        COALESCE((
          SELECT SUM(pr.amount)
          FROM public.payout_requests pr
          WHERE pr.supplier_id = p_supplier_id
            AND pr.status IN ('pending','processing')
        ), 0)
      )::NUMERIC, 2)
    )::NUMERIC
  FROM public.orders o
  WHERE o.supplier_id = p_supplier_id
    AND o.created_at >= start_ts;
END;
$;

GRANT EXECUTE ON FUNCTION public.get_supplier_earnings(UUID, TEXT)
  TO authenticated, service_role;

SELECT pg_notify('pgrst', 'reload schema');
