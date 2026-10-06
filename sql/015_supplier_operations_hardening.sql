-- AuroWater — supplier operations hardening
-- Migration: 015_supplier_operations_hardening.sql
-- Safe to run more than once.

BEGIN;

-- ============================================================
-- 1) Inventory reservation
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

  UPDATE public.supplier_stock
  SET reserved_cans = GREATEST(0, reserved_cans - p_quantity),
      updated_at = NOW()
  WHERE supplier_id = p_supplier_id
    AND reserved_cans >= p_quantity;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

-- The API now performs atomic inventory reservation/consumption.
-- Remove the older completion trigger if it exists so stock is never deducted twice.
DROP TRIGGER IF EXISTS trg_deduct_stock ON public.orders;

-- ============================================================
-- 2) Payout ledger hardening
-- ============================================================

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.payouts
SET status = CASE
  WHEN status IS NULL AND paid_at IS NOT NULL THEN 'paid'
  WHEN status IS NULL THEN 'pending'
  ELSE status
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

-- ============================================================
-- 3) Supplier payout amount is immutable at dispatch
-- ============================================================

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

-- ============================================================
-- 4) Realtime
-- ============================================================

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
