-- AuroTap Noida Sector 73 pilot zone (staged, NOT live by default).
-- Apply only after reviewing the production schema. This migration deliberately leaves
-- the zone COMING_SOON. Admin should approve a real supplier mapping and verify stock
-- before manually changing this one zone to AVAILABLE.
-- Do not activate the Noida catch-all zone; other Noida sectors must remain unavailable.

BEGIN;

DO $preflight$
DECLARE
  required_column TEXT;
BEGIN
  IF to_regclass('public.service_zones') IS NULL THEN
    RAISE EXCEPTION 'public.service_zones is missing; stop and verify the deployed schema';
  END IF;

  FOREACH required_column IN ARRAY ARRAY[
    'city', 'name', 'slug', 'status', 'pincodes',
    'center_lat', 'center_lng', 'radius_km', 'services',
    'is_catch_all', 'notes'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'service_zones'
        AND column_name = required_column
    ) THEN
      RAISE EXCEPTION 'public.service_zones.% is missing; stop and verify the deployed schema', required_column;
    END IF;
  END LOOP;
END
$preflight$;

INSERT INTO public.service_zones
  (city, name, slug, status, pincodes, center_lat, center_lng, radius_km, services, is_catch_all, notes)
VALUES
  (
    'Noida',
    'Noida Sector 73 Pilot',
    'noida-sector-73-pilot',
    'COMING_SOON',
    ARRAY[]::text[],
    28.5865,
    77.3871,
    1.5,
    ARRAY['water_can']::text[],
    FALSE,
    'Pilot boundary only. Confirm exact customer GPS, local PIN mapping, supplier approval, stock and dispatch before activating.'
  )
ON CONFLICT (slug) DO NOTHING;

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.service_zones
    WHERE slug = 'noida-sector-73-pilot'
      AND city = 'Noida'
      AND status = 'COMING_SOON'
      AND is_catch_all = FALSE
  ) THEN
    RAISE EXCEPTION 'Noida Sector 73 pilot verification failed; inspect the existing row before proceeding';
  END IF;
END
$verify$;

COMMIT;

-- After a real supplier is approved for this exact zone and has confirmed stock,
-- verify the mapping first:
-- SELECT z.city, z.name, z.status, sz.supplier_id, sz.service_keys
-- FROM public.service_zones z
-- LEFT JOIN public.supplier_zones sz ON sz.zone_id = z.id
-- WHERE z.slug = 'noida-sector-73-pilot';
--
-- Activate only after a live test order reaches the supplier:
-- UPDATE public.service_zones SET status = 'AVAILABLE'
-- WHERE slug = 'noida-sector-73-pilot' AND status = 'COMING_SOON';
