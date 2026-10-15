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

-- Complete a supplier order and post its verified entitlement in the same transaction.
-- Only the confirmed single-can ₹20 order rule is credited automatically. Other amounts
-- remain unposted until the supplier payout schedule is approved.
CREATE OR REPLACE FUNCTION public.complete_supplier_order_atomic(
  p_order_id UUID,
  p_supplier_id UUID,
  p_payment_confirmed BOOLEAN,
  p_payment_reference TEXT,
  p_payment_collector TEXT
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_role TEXT;
  v_order public.orders%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_was_paid BOOLEAN;
  v_method TEXT;
  v_supplier_entitlement NUMERIC(10,2);
BEGIN
  IF auth.uid() IS DISTINCT FROM p_supplier_id THEN
    RAISE EXCEPTION 'supplier_identity_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_role IS DISTINCT FROM 'supplier' THEN
    RAISE EXCEPTION 'supplier_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found_or_forbidden' USING ERRCODE = '42501'; END IF;
  IF upper(COALESCE(v_order.status, '')) <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'invalid_order_transition' USING ERRCODE = '40001';
  END IF;

  v_was_paid := lower(COALESCE(v_order.payment_status, 'unpaid')) = 'paid';
  v_method := lower(COALESCE(v_order.payment_method, 'cash'));

  IF NOT v_was_paid AND p_payment_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'payment_confirmation_required' USING ERRCODE = '22023';
  END IF;
  IF NOT v_was_paid AND v_method = 'upi' AND NULLIF(btrim(COALESCE(p_payment_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'upi_reference_required' USING ERRCODE = '22023';
  END IF;
  IF NOT v_was_paid AND (
    p_payment_collector IS NULL OR p_payment_collector NOT IN ('supplier', 'aurotap')
  ) THEN
    RAISE EXCEPTION 'payment_collector_required' USING ERRCODE = '22023';
  END IF;

  -- The approved single-can launch case is ₹20 customer total -> ₹20 supplier entitlement.
  -- Never infer multi-can or non-standard supplier rates from the customer total.
  v_supplier_entitlement := NULL;
  IF lower(COALESCE(v_order.service_type, '')) = 'water_can'
     AND COALESCE(v_order.can_count, 0) = 1
     AND COALESCE(v_order.total_amount, 0) = 20 THEN
    v_supplier_entitlement := 20;
  END IF;

  UPDATE public.orders
  SET status = 'COMPLETED',
      completed_at = v_now,
      payment_status = CASE WHEN v_was_paid THEN payment_status ELSE 'paid' END,
      payment_confirmed_at = CASE WHEN v_was_paid THEN payment_confirmed_at ELSE v_now END,
      payment_reference = CASE WHEN v_was_paid THEN payment_reference ELSE NULLIF(btrim(COALESCE(p_payment_reference, '')), '') END,
      payment_collector = CASE WHEN v_was_paid THEN payment_collector ELSE p_payment_collector END,
      payment_collected_by = CASE WHEN v_was_paid THEN payment_collected_by WHEN p_payment_collector = 'supplier' THEN p_supplier_id ELSE NULL END,
      payment_collected_amount = CASE WHEN v_was_paid THEN payment_collected_amount ELSE total_amount END,
      payment_collected_at = CASE WHEN v_was_paid THEN payment_collected_at ELSE v_now END,
      supplier_payout = CASE
        WHEN v_supplier_entitlement IS NOT NULL
          AND financials_posted_at IS NULL
          AND COALESCE(supplier_payout, 0) <> v_supplier_entitlement
        THEN v_supplier_entitlement
        ELSE supplier_payout
      END,
      payout_status = CASE
        WHEN v_supplier_entitlement IS NOT NULL
          AND financials_posted_at IS NULL
          AND COALESCE(supplier_payout, 0) <> v_supplier_entitlement
        THEN 'pending'
        ELSE payout_status
      END
  WHERE id = p_order_id AND supplier_id = p_supplier_id
  RETURNING * INTO v_order;

  IF v_supplier_entitlement IS NOT NULL AND v_order.financials_posted_at IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_ledger wl
      WHERE wl.order_id = p_order_id AND wl.entry_type = 'ORDER_EARNING'
    ) THEN
      INSERT INTO public.wallet_ledger (
        payee_id, payee_role, order_id, entry_type, amount, note, metadata, created_by
      )
      VALUES (
        p_supplier_id, 'supplier', p_order_id, 'ORDER_EARNING', v_supplier_entitlement,
        'Supplier entitlement for verified ₹20 single-can water order',
        jsonb_build_object('service_type', 'water_can', 'can_count', 1, 'customer_total', v_order.total_amount),
        p_supplier_id
      );
    ELSE
      RAISE EXCEPTION 'order_earning_ledger_already_exists' USING ERRCODE = '23505';
    END IF;

    UPDATE public.orders
    SET financials_posted_at = v_now, financials_payee_id = p_supplier_id
    WHERE id = p_order_id AND supplier_id = p_supplier_id
    RETURNING * INTO v_order;
  END IF;

  RETURN NEXT v_order;
END;
$;

REVOKE ALL ON FUNCTION public.complete_supplier_order_atomic(UUID, UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_supplier_order_atomic(UUID, UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

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

  -- A legacy payout marked paid without its immutable ledger debit must be reconciled
  -- before another request; otherwise the same earnings could be requested twice.
  IF EXISTS (
    SELECT 1 FROM public.payouts p
    WHERE p.user_id = v_user_id AND p.role = 'supplier'
      AND lower(COALESCE(p.status, 'pending')) = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM public.wallet_ledger wl
        WHERE wl.payout_id = p.id AND wl.entry_type = 'PAYOUT'
      )
  ) THEN
    RAISE EXCEPTION 'payout_settlement_requires_reconciliation' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payouts p
    WHERE p.user_id = v_user_id AND p.role = 'supplier'
      AND lower(COALESCE(p.status, 'pending')) IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'payout_request_pending' USING ERRCODE = '23505';
  END IF;

  IF COALESCE(public.payee_balance(v_user_id), 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_verified_supplier_balance' USING ERRCODE = '22023';
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
