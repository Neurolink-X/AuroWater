BEGIN;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS payload jsonb;
CREATE TABLE IF NOT EXISTS public.technician_service_capabilities (
 technician_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 service_key text NOT NULL REFERENCES public.service_types(key),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
 reviewed_by uuid REFERENCES public.profiles(id), reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(technician_id,service_key)
);
CREATE INDEX IF NOT EXISTS technician_service_capabilities_approved_idx
 ON public.technician_service_capabilities(service_key,technician_id) WHERE status='approved';
ALTER TABLE public.technician_service_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technician_service_capabilities FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.technician_service_capabilities TO service_role;
COMMIT;
