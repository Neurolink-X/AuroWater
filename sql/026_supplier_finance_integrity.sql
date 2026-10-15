-- AuroTap supplier finance integrity: additive, forward-only migration.
-- Does not rewrite historical orders, payouts, or ledger entries.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_collector TEXT,
  ADD COLUMN IF NOT EXISTS payment_collected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_collected_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_collected_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_payment_collector_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_collector_check
      CHECK (payment_collector IS NULL OR payment_collector IN ('supplier', 'aurotap')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_payment_collected_amount_nonnegative'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_collected_amount_nonnegative
      CHECK (payment_collected_amount IS NULL OR payment_collected_amount >= 0) NOT VALID;
  END IF;
END
$$;

-- Supplier earnings are the supplier's entitlement, not customer gross sales.
-- Restrict direct RPC calls so a supplier cannot query another supplier's totals.
CREATE OR REPLACE FUNCTION public.get_supplier_earnings(p_supplier_id UUID, p_period TEXT)
RETURNS TABLE (period_label TEXT, order_count BIGINT, gross_amount NUMERIC, pending_payout NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  start_ts TIMESTAMPTZ;
  pl TEXT;
  caller_role TEXT;
BEGIN
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF auth.uid() IS DISTINCT FROM p_supplier_id AND caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden_supplier_earnings' USING ERRCODE = '42501';
  END IF;

  pl := lower(coalesce(p_period, 'month'));
  IF pl NOT IN ('today', 'week', 'month') THEN pl := 'month'; END IF;
  start_ts := CASE pl
    WHEN 'today' THEN date_trunc('day', NOW())
    WHEN 'week' THEN date_trunc('week', NOW())
    ELSE date_trunc('month', NOW())
  END;

  RETURN QUERY
  SELECT pl::TEXT, COUNT(*)::BIGINT,
    COALESCE(SUM(o.supplier_payout) FILTER (WHERE COALESCE(o.supplier_payout, 0) > 0), 0)::NUMERIC,
    COALESCE(SUM(o.supplier_payout) FILTER (
      WHERE COALESCE(o.supplier_payout, 0) > 0
        AND lower(COALESCE(o.payout_status, 'pending')) = 'pending'
    ), 0)::NUMERIC
  FROM public.orders o
  WHERE o.supplier_id = p_supplier_id
    AND upper(COALESCE(o.status, '')) = 'COMPLETED'
    AND COALESCE(o.completed_at, o.created_at) >= start_ts;
END;
$$;

-- Atomic payout request creation; advisory lock serializes concurrent requests per supplier.
CREATE OR REPLACE FUNCTION public.request_supplier_payout(
  p_amount NUMERIC, p_method TEXT, p_details JSONB
)
RETURNS TABLE (id UUID, amount NUMERIC, method TEXT, status TEXT, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_row public.payouts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'invalid_payout_amount' USING ERRCODE = '22023';
  END IF;
  IF p_method NOT IN ('upi', 'bank') OR jsonb_typeof(COALESCE(p_details, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payout_details' USING ERRCODE = '22023';
  END IF;
  IF p_method = 'upi' AND COALESCE(p_details->>'upi_id', '') !~* '^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$' THEN
    RAISE EXCEPTION 'invalid_upi_id' USING ERRCODE = '22023';
  END IF;
  IF p_method = 'bank' AND (
    COALESCE(p_details->>'bank_account', '') !~ '^[0-9]{9,18}$'
    OR COALESCE(p_details->>'ifsc', '') !~* '^[A-Z]{4}0[A-Z0-9]{6}$'
  ) THEN
    RAISE EXCEPTION 'invalid_bank_details' USING ERRCODE = '22023';
  END IF;

  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_user_id;
  IF v_role IS DISTINCT FROM 'supplier' THEN RAISE EXCEPTION 'supplier_role_required' USING ERRCODE = '42501'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT || ':supplier_payout', 0));
  IF EXISTS (
    SELECT 1 FROM public.payouts p
    WHERE p.user_id = v_user_id AND p.role = 'supplier'
      AND lower(COALESCE(p.status, 'pending')) IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'payout_request_pending' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.payouts (user_id, role, amount, status, method, note, payout_details, paid_at)
  VALUES (v_user_id, 'supplier', p_amount, 'pending', p_method, 'Supplier payout request', p_details, NULL)
  RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.id, v_row.amount, v_row.method, v_row.status, v_row.paid_at, v_row.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.request_supplier_payout(NUMERIC, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_supplier_payout(NUMERIC, TEXT, JSONB) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
COMMIT;
