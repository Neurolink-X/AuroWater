-- Partner application submission must pass authenticated server validation.
-- Client sessions may read their own application receipt, but must never edit
-- approval status, reviewer, documents, role, or decision notes over PostgREST.
-- Safe/idempotent; no existing application rows are modified.
BEGIN;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_own ON public.applications;
DROP POLICY IF EXISTS applications_owner_select ON public.applications;
CREATE POLICY applications_owner_select ON public.applications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- The authenticated API uses the server's service-role client only after
-- session verification and Zod validation. Do not add direct user INSERT,
-- UPDATE or DELETE policies here.
-- Preserve existing admin/service policies, and safeguard retry races.
CREATE UNIQUE INDEX IF NOT EXISTS applications_one_pending_per_role_idx
  ON public.applications (user_id, type)
  WHERE status IN ('pending', 'pending_approval');

COMMIT;
