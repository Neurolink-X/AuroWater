-- Supplier payout request ledger (additive; no existing payout/order rows are changed).
-- Apply after the existing supplier/profile schema in Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS public.supplier_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('upi', 'bank')),
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'under_review', 'approved', 'paid', 'rejected')),
  payout_reference text,
  notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_payout_requests_supplier_created_idx
  ON public.supplier_payout_requests (supplier_id, created_at DESC);

ALTER TABLE public.supplier_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_payout_requests_select_own_or_admin
  ON public.supplier_payout_requests;
CREATE POLICY supplier_payout_requests_select_own_or_admin
  ON public.supplier_payout_requests FOR SELECT
  USING (supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin');

-- Supplier requests may be created for themselves; supplier cannot mark payouts paid.
DROP POLICY IF EXISTS supplier_payout_requests_insert_own
  ON public.supplier_payout_requests;
CREATE POLICY supplier_payout_requests_insert_own
  ON public.supplier_payout_requests FOR INSERT
  WITH CHECK (supplier_id = auth.uid() AND status = 'requested');

DROP POLICY IF EXISTS supplier_payout_requests_update_admin
  ON public.supplier_payout_requests;
CREATE POLICY supplier_payout_requests_update_admin
  ON public.supplier_payout_requests FOR UPDATE
  USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP TRIGGER IF EXISTS supplier_payout_requests_updated_at
  ON public.supplier_payout_requests;
CREATE TRIGGER supplier_payout_requests_updated_at
  BEFORE UPDATE ON public.supplier_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
