-- AuroTap NCR expansion staging: add non-bookable catch-all zones.
-- Safe to run repeatedly. This does NOT activate NCR bookings.
-- Existing slugs are left untouched so manually managed zone settings are not overwritten.
-- Apply only after reviewing the target Supabase schema; this repository's runtime already
-- expects these columns, but the service_zones DDL is managed outside the checked-in migrations.

BEGIN;

DO $preflight$
DECLARE
  required_column TEXT;
BEGIN
  IF to_regclass('public.service_zones') IS NULL THEN
    RAISE EXCEPTION 'public.service_zones is missing; stop and verify the deployed Supabase schema before applying this seed';
  END IF;

  FOREACH required_column IN ARRAY ARRAY[
    'city', 'name', 'slug', 'status', 'pincodes',
    'center_lat', 'center_lng', 'radius_km', 'services',
    'is_catch_all', 'notes'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'service_zones'
        AND column_name = required_column
    ) THEN
      RAISE EXCEPTION 'public.service_zones.% is missing; stop and verify the deployed Supabase schema', required_column;
    END IF;
  END LOOP;
END
$preflight$;

INSERT INTO public.service_zones
  (city, name, slug, status, pincodes, center_lat, center_lng, radius_km, services, is_catch_all, notes)
VALUES
  ('Delhi', 'Delhi NCR — Delhi', 'delhi-delhi-ncr-delhi', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'Expansion interest only. All localities are non-bookable until service capacity and pincode coverage are verified.'),
  ('New Delhi', 'Delhi NCR — New Delhi', 'new-delhi-delhi-ncr-new-delhi', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'Expansion interest only. All localities are non-bookable until service capacity and pincode coverage are verified.'),
  ('Noida', 'Delhi NCR — Noida', 'noida-delhi-ncr-noida', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'Expansion interest only; includes sectors as waitlist interest, not confirmed service coverage.'),
  ('Greater Noida', 'Delhi NCR — Greater Noida', 'greater-noida-delhi-ncr-greater-noida', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'Expansion interest only; includes sectors as waitlist interest, not confirmed service coverage.'),
  ('Gautam Buddha Nagar', 'Delhi NCR — Gautam Buddha Nagar', 'gautam-buddha-nagar-delhi-ncr-gautam-buddha-nagar', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'Expansion interest only. District/city aliases are staged as non-bookable.'),
  ('Ghaziabad', 'Delhi NCR — Ghaziabad', 'ghaziabad-delhi-ncr-ghaziabad', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'Expansion interest only; all localities remain non-bookable until service capacity and pincode coverage are verified.'),
  ('Gurugram', 'Delhi NCR — Gurugram', 'gurugram-delhi-ncr-gurugram', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'Expansion interest only; all localities remain non-bookable until service capacity and pincode coverage are verified.'),
  ('Gurgaon', 'Delhi NCR — Gurgaon', 'gurgaon-delhi-ncr-gurgaon', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'City-name alias for Gurugram; expansion interest only and non-bookable.'),
  ('Faridabad', 'Delhi NCR — Faridabad', 'faridabad-delhi-ncr-faridabad', 'COMING_SOON', ARRAY[]::text[], NULL, NULL, NULL, NULL, TRUE,
   'Expansion interest only; all localities remain non-bookable until service capacity and pincode coverage are verified.')
ON CONFLICT (slug) DO NOTHING;

-- Post-apply verification: all expected labels should exist. This does not change existing rows.
DO $verify$
DECLARE
  expected_count INTEGER := 9;
  actual_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO actual_count
  FROM public.service_zones
  WHERE slug IN (
    'delhi-delhi-ncr-delhi',
    'new-delhi-delhi-ncr-new-delhi',
    'noida-delhi-ncr-noida',
    'greater-noida-delhi-ncr-greater-noida',
    'gautam-buddha-nagar-delhi-ncr-gautam-buddha-nagar',
    'ghaziabad-delhi-ncr-ghaziabad',
    'gurugram-delhi-ncr-gurugram',
    'gurgaon-delhi-ncr-gurgaon',
    'faridabad-delhi-ncr-faridabad'
  );

  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'NCR zone seed verification failed: expected % rows, found %', expected_count, actual_count;
  END IF;
END
$verify$;

COMMIT;

-- Review after applying:
-- SELECT city, name, status, is_catch_all, pincodes
-- FROM public.service_zones
-- WHERE slug LIKE '%delhi-ncr%'
-- ORDER BY city;
