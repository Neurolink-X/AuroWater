-- 006_schema_compat.sql — additive fixes for code↔schema alignment (idempotent, no data deletion)
-- Run after 001–005. Safe to re-run.

-- Reviews flow: customer API updates orders.has_review
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS has_review BOOLEAN NOT NULL DEFAULT false;

-- Admin dashboard KPI: online technicians count
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

-- Optional KPI tables referenced by /api/admin/dashboard (minimal stubs)
CREATE TABLE IF NOT EXISTS public.applications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolved   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_admin_all" ON public.applications;
CREATE POLICY "applications_admin_all" ON public.applications
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "fraud_flags_admin_all" ON public.fraud_flags;
CREATE POLICY "fraud_flags_admin_all" ON public.fraud_flags
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- Refresh PostgREST schema cache so /rest/v1/rpc and table routes see DDL above immediately.
-- Fixes persistent PGRST205 ("could not find the table in the schema cache") after migrations.
NOTIFY pgrst, 'reload schema';
