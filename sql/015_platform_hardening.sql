-- 015_platform_hardening.sql
-- AuroWater production hardening:
-- contact subjects, inventory reservation, payout requests, and atomic supplier transitions.
-- Idempotent.

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS subject TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_reserved_qty INTEGER NOT NULL DEFAULT 0
    CHECK (stock_reserved_qty >= 0);

ALTER TABLE public.supplier_stock
  ADD COLUMN IF NOT EXISTS reserved_cans INTEGER NOT NULL DEFAULT 0
    CHECK (reserved_cans >= 0);

-- Payout requests are separate from completed payout records so a request can be
-- audited through pending -> processing -> paid/rejected without pretending money moved.
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method              TEXT NOT NULL DEFAULT 'upi'
                        CHECK (method IN ('upi','bank')),
  destination_reference TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','paid','rejected','cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  processed_by        UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS payout_requests_supplier_created_idx
  ON public.payout_requests(supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payout_requests_status_created_idx
  ON public.payout_requests(status, created_at ASC);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_requests_select_own_or_admin" ON public.payout_requests;
CREATE POLICY "payout_requests_select_own_or_admin" ON public.payout_requests
  FOR SELECT USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "payout_requests_insert_own_or_admin" ON public.payout_requests;
CREATE POLICY "payout_requests_insert_own_or_admin" ON public.payout_requests
  FOR INSERT WITH CHECK (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "payout_requests_update_admin" ON public.payout_requests;
CREATE POLICY "payout_requests_update_admin" ON public.payout_requests
  FOR UPDATE USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP TRIGGER IF EXISTS payout_requests_updated_at ON public.payout_requests;
CREATE TRIGGER payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Atomic stock reserve: available stock is reduced immediately and moved into reserved stock.
CREATE OR REPLACE FUNCTION public.reserve_supplier_stock(
  p_supplier_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.supplier_stock
  SET
    cans_available = cans_available - p_quantity,
    reserved_cans = reserved_cans + p_quantity,
    updated_at = NOW()
  WHERE supplier_id = p_supplier_id
    AND cans_available >= p_quantity;

  RETURN FOUND;
END;
$$;

-- Release an accepted reservation back into available stock.
CREATE OR REPLACE FUNCTION public.release_supplier_stock(
  p_supplier_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.supplier_stock
  SET
    cans_available = cans_available + p_quantity,
    reserved_cans = GREATEST(0, reserved_cans - p_quantity),
    updated_at = NOW()
  WHERE supplier_id = p_supplier_id
    AND reserved_cans >= p_quantity;

  RETURN FOUND;
END;
$$;

-- Disable the legacy completion trigger. New order completion consumes reserved stock atomically.
DROP TRIGGER IF EXISTS trg_deduct_stock ON public.orders;

-- Consume reserved stock after successful delivery.
CREATE OR REPLACE FUNCTION public.consume_supplier_reserved_stock(
  p_supplier_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN TRUE;
  END IF;

  UPDATE public.supplier_stock
  SET
    reserved_cans = reserved_cans - p_quantity,
    updated_at = NOW()
  WHERE supplier_id = p_supplier_id
    AND reserved_cans >= p_quantity;

  RETURN FOUND;
END;
$$;

-- One transaction for supplier acceptance + reservation.
-- This is the authoritative "accept" operation.
CREATE OR REPLACE FUNCTION public.supplier_accept_order(
  p_order_id UUID,
  p_supplier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_qty INTEGER;
  v_reserved INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND supplier_id = p_supplier_id
    AND status = 'ASSIGNED'
    AND accepted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'not_assignable'
    );
  END IF;

  v_qty := GREATEST(1, COALESCE(v_order.can_quantity, 1));

  INSERT INTO public.supplier_stock (supplier_id, cans_available, reserved_cans, low_stock_alert)
  VALUES (p_supplier_id, 0, 0, 10)
  ON CONFLICT (supplier_id) DO NOTHING;

  SELECT reserved_cans
  INTO v_reserved
  FROM public.supplier_stock
  WHERE supplier_id = p_supplier_id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.supplier_stock
    WHERE supplier_id = p_supplier_id
      AND cans_available >= v_qty
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_stock',
      'required', v_qty
    );
  END IF;

  UPDATE public.supplier_stock
  SET
    cans_available = cans_available - v_qty,
    reserved_cans = reserved_cans + v_qty,
    updated_at = v_now
  WHERE supplier_id = p_supplier_id;

  UPDATE public.orders
  SET
    accepted_at = v_now,
    stock_reserved_qty = v_qty,
    updated_at = v_now
  WHERE id = p_order_id;

  UPDATE public.order_dispatch
  SET
    status = 'ACCEPTED',
    responded_at = v_now
  WHERE order_id = p_order_id
    AND supplier_id = p_supplier_id
    AND status = 'ASSIGNED';

  RETURN jsonb_build_object(
    'ok', true,
    'customer_id', v_order.customer_id,
    'reserved_qty', v_qty
  );
END;
$$;

-- One transaction for supplier completion + reserved-stock consumption.
CREATE OR REPLACE FUNCTION public.supplier_complete_order(
  p_order_id UUID,
  p_supplier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_qty INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND supplier_id = p_supplier_id
    AND status = 'IN_PROGRESS'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_transition');
  END IF;

  v_qty := GREATEST(0, COALESCE(v_order.stock_reserved_qty, 0));

  IF v_qty > 0 THEN
    UPDATE public.supplier_stock
    SET
      reserved_cans = reserved_cans - v_qty,
      updated_at = v_now
    WHERE supplier_id = p_supplier_id
      AND reserved_cans >= v_qty;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'reserved_stock_missing');
    END IF;
  END IF;

  UPDATE public.orders
  SET
    status = 'COMPLETED',
    completed_at = COALESCE(completed_at, v_now),
    stock_reserved_qty = 0,
    payout_status = COALESCE(payout_status, 'pending'),
    updated_at = v_now
  WHERE id = p_order_id;

  UPDATE public.profiles
  SET completed_orders = COALESCE(completed_orders, 0) + 1,
      updated_at = v_now
  WHERE id = p_supplier_id;

  RETURN jsonb_build_object(
    'ok', true,
    'customer_id', v_order.customer_id,
    'reserved_qty', v_qty
  );
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');
