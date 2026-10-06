-- AuroWater — supplier operations hardening
-- Migration: 015_supplier_operations_hardening.sql
-- Safe to run more than once.

BEGIN;

-- ============================================================
-- 1) Atomic supplier inventory reservation
-- ============================================================

ALTER TABLE public.supplier_stock
  ADD COLUMN IF NOT EXISTS reserved_cans INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.supplier_stock
  DROP CONSTRAINT IF EXISTS supplier_stock_reserved_nonnegative;

ALTER TABLE public.supplier_stock
  ADD CONSTRAINT supplier_stock_reserved_nonnegative
  CHECK (reserved_cans >= 0);

ALTER TABLE public.supplier_stock
  DROP CONSTRAINT IF EXISTS supplier_stock_available_nonnegative;

ALTER TABLE public.supplier_stock
  ADD CONSTRAINT supplier_stock_available_nonnegative
  CHECK (cans_available >= 0);

CREATE OR REPLACE FUNCTION public.reserve_supplier_stock(
  p_supplier_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_supplier_id
     AND COALESCE(public.current_profile_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.supplier_stock
  SET reserved_cans = reserved_cans + p_quantity,
      updated_at = NOW()
  WHERE supplier_id = p_supplier_id
    AND (cans_available - reserved_cans) >= p_quantity;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_reserved_supplier_stock(
  p_supplier_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN TRUE;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_supplier_id
     AND COALESCE(public.current_profile_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.supplier_stock
  SET cans_available = GREATEST(0, cans_available - p_quantity),
      reserved_cans = GREATEST(0, reserved_cans - p_quantity),
      updated_at = NOW()
  WHERE supplier_id = p_supplier_id
    AND reserved_cans >= p_quantity;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_reserved_supplier_stock(
  p_supplier_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN TRUE;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_supplier_id
     AND COALESCE(public.current_profile_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.supplier_stock
  SET reserved_cans = GREATEST(0, reserved_cans - p_quantity),
      updated_at = NOW()
  WHERE supplier_id = p_supplier_id
    AND reserved_cans >= p_quantity;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_stock ON public.orders;

-- ============================================================
-- 2) Supplier payout ledger
-- ============================================================

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.payouts
SET status = CASE
  WHEN status IS NULL AND paid_at IS NOT NULL THEN 'paid'
  ELSE COALESCE(status, 'pending')
END;

ALTER TABLE public.payouts
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.payouts
  DROP CONSTRAINT IF EXISTS payouts_status_check;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_status_check
  CHECK (status IN ('pending', 'processing', 'paid', 'rejected'));

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.payouts
  ALTER COLUMN paid_at DROP NOT NULL,
  ALTER COLUMN paid_at DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS payouts_supplier_active_idx
ON public.payouts (supplier_id)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS payouts_supplier_status_requested_idx
ON public.payouts (supplier_id, status, requested_at DESC);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES public.payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_supplier_payout_idx
ON public.orders (supplier_id, payout_status, payout_id)
WHERE supplier_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_supplier_commission_rate(
  p_supplier_id UUID
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT commission_rate
      FROM public.supplier_settings
      WHERE user_id = p_supplier_id
      LIMIT 1
    ),
    (
      SELECT NULLIF(value, '')::NUMERIC
      FROM public.settings
      WHERE key = 'supplier_commission'
      LIMIT 1
    ),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.get_supplier_earnings(
  p_supplier_id UUID,
  p_period TEXT
)
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
AS $$
DECLARE
  start_ts TIMESTAMPTZ;
  pl TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_supplier_id
     AND COALESCE(public.current_profile_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

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
    (
      SELECT COUNT(*)
      FROM public.orders o
      WHERE o.supplier_id = p_supplier_id
        AND o.created_at >= start_ts
    )::BIGINT,
    COALESCE((
      SELECT SUM(o.total_amount)
      FROM public.orders o
      WHERE o.supplier_id = p_supplier_id
        AND o.status = 'COMPLETED'
        AND o.created_at >= start_ts
    ), 0)::NUMERIC,
    COALESCE((
      SELECT SUM(o.supplier_payout)
      FROM public.orders o
      WHERE o.supplier_id = p_supplier_id
        AND o.status = 'COMPLETED'
        AND o.payout_status = 'pending'
        AND o.supplier_payout > 0
    ), 0)::NUMERIC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_payout_request(
  p_supplier_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_reference TEXT,
  p_notes TEXT
)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_amount NUMERIC;
  created public.payouts;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  SELECT COALESCE(SUM(o.supplier_payout), 0)
  INTO pending_amount
  FROM public.orders o
  WHERE o.supplier_id = p_supplier_id
    AND o.status = 'COMPLETED'
    AND o.payout_status = 'pending'
    AND o.supplier_payout > 0;

  IF ABS(p_amount - pending_amount) > 0.01 THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_PENDING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payouts
    WHERE supplier_id = p_supplier_id
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'ACTIVE_PAYOUT';
  END IF;

  INSERT INTO public.payouts (
    supplier_id,
    amount,
    method,
    reference,
    notes,
    status,
    requested_at,
    paid_at,
    processed_at
  )
  VALUES (
    p_supplier_id,
    p_amount,
    p_method,
    p_reference,
    p_notes,
    'pending',
    NOW(),
    NULL,
    NULL
  )
  RETURNING * INTO created;

  UPDATE public.orders
  SET payout_status = 'processing',
      payout_id = created.id
  WHERE supplier_id = p_supplier_id
    AND status = 'COMPLETED'
    AND payout_status = 'pending'
    AND supplier_payout > 0;

  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_supplier_payout(
  p_payout_id UUID,
  p_status TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.payouts;
  updated_row public.payouts;
BEGIN
  IF p_status NOT IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_STATUS';
  END IF;

  SELECT *
  INTO current_row
  FROM public.payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF current_row.id IS NULL THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND';
  END IF;

  UPDATE public.payouts
  SET status = p_status,
      reference = COALESCE(p_reference, reference),
      processed_at = NOW(),
      paid_at = CASE WHEN p_status = 'paid' THEN NOW() ELSE NULL END
  WHERE id = p_payout_id
  RETURNING * INTO updated_row;

  IF p_status = 'paid' THEN
    UPDATE public.orders
    SET payout_status = 'paid'
    WHERE payout_id = p_payout_id;
  ELSE
    UPDATE public.orders
    SET payout_status = 'pending',
        payout_id = NULL
    WHERE payout_id = p_payout_id;
  END IF;

  RETURN updated_row;
END;
$$;

-- ============================================================
-- 3) Supplier settings/stock resiliency
-- ============================================================

DROP POLICY IF EXISTS "supplier_settings_insert_admin" ON public.supplier_settings;
CREATE POLICY "supplier_settings_insert_own_or_admin" ON public.supplier_settings
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_stock_insert_admin" ON public.supplier_stock;
CREATE POLICY "supplier_stock_insert_own_or_admin" ON public.supplier_stock
  FOR INSERT WITH CHECK (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

REVOKE ALL ON FUNCTION public.get_supplier_commission_rate(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_supplier_payout_request(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_supplier_payout(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_commission_rate(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_supplier_payout_request(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_supplier_payout(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_supplier_stock(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_reserved_supplier_stock(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_reserved_supplier_stock(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_supplier_earnings(UUID, TEXT) TO authenticated, service_role;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
