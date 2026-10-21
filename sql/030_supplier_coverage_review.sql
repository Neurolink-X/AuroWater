-- Supplier-selected service-area requests with admin review.
-- Safe additive migration: does not change existing serviceability or activate any zone.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'public.profiles is missing; stop and verify the deployed schema';
  END IF;
  IF to_regclass('public.service_zones') IS NULL THEN
    RAISE EXCEPTION 'public.service_zones is missing; apply the service-zone schema first';
  END IF;
  IF to_regclass('public.supplier_zones') IS NULL THEN
    RAISE EXCEPTION 'public.supplier_zones is missing; apply the supplier-zone schema first';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='service_zones' AND column_name='id'
  ) THEN
    RAISE EXCEPTION 'public.service_zones.id is missing; verify schema before continuing';
  END IF;
END
$preflight$;

ALTER TABLE public.supplier_zones ADD COLUMN IF NOT EXISTS service_keys text[];

CREATE TABLE IF NOT EXISTS public.supplier_zone_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.service_zones(id) ON DELETE CASCADE,
  service_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  supplier_note text,
  admin_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, zone_id)
);

CREATE INDEX IF NOT EXISTS supplier_zone_requests_status_created_idx
  ON public.supplier_zone_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_zone_requests_supplier_idx
  ON public.supplier_zone_requests (supplier_id, updated_at DESC);

ALTER TABLE public.supplier_zone_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supplier_zone_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.supplier_zone_requests TO service_role;

COMMIT;

-- Verification:
-- SELECT status, count(*) FROM public.supplier_zone_requests GROUP BY status;
-- Important: approving a request maps the supplier to a zone, but does not make a
-- COMING_SOON zone bookable. An admin must separately verify capacity and change the zone status.
