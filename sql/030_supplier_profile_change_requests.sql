-- AuroTap supplier profile change requests
-- Additive migration: does not overwrite profiles or active dispatch settings.
BEGIN;
CREATE TABLE IF NOT EXISTS public.supplier_profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_changes JSONB NOT NULL CHECK (jsonb_typeof(requested_changes) = 'object'),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_profile_change_requests_supplier_created_idx
  ON public.supplier_profile_change_requests(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_profile_change_requests_status_created_idx
  ON public.supplier_profile_change_requests(status, created_at DESC);
ALTER TABLE public.supplier_profile_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_profile_change_requests_read_own ON public.supplier_profile_change_requests;
CREATE POLICY supplier_profile_change_requests_read_own ON public.supplier_profile_change_requests
  FOR SELECT TO authenticated USING (supplier_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.supplier_profile_change_requests FROM anon, authenticated;
COMMIT;
