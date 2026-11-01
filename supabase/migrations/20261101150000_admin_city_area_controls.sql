-- Add auditable customer-facing operations and PIN-level area controls
-- for the four launch cities. Postal PINs are approximate locality groups;
-- each city's All areas zone remains the fallback for unmapped addresses.
ALTER TABLE public.service_zones
  ADD COLUMN IF NOT EXISTS customer_message text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_zones'::regclass
      AND conname = 'service_zones_customer_message_length'
  ) THEN
    ALTER TABLE public.service_zones
      ADD CONSTRAINT service_zones_customer_message_length
      CHECK (customer_message IS NULL OR char_length(customer_message) <= 500);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS service_zones_city_status_idx
  ON public.service_zones(city_id, status);

WITH postal_areas AS (
  SELECT
    c.id AS city_id,
    c.name AS city,
    c.slug AS city_slug,
    d.pincode,
    COALESCE(MIN(NULLIF(BTRIM(d.office_name), '')), 'PIN area') AS area_name,
    AVG(d.lat) FILTER (WHERE d.lat IS NOT NULL) AS center_lat,
    AVG(d.lng) FILTER (WHERE d.lng IS NOT NULL) AS center_lng
  FROM public.cities AS c
  JOIN public.pincode_directory AS d
    ON UPPER(BTRIM(d.state)) = 'UTTAR PRADESH'
   AND UPPER(BTRIM(d.district)) = CASE c.slug
     WHEN 'kanpur' THEN 'KANPUR NAGAR'
     WHEN 'lucknow' THEN 'LUCKNOW'
     WHEN 'noida' THEN 'GAUTAM BUDDHA NAGAR'
     WHEN 'gorakhpur' THEN 'GORAKHPUR'
   END
  WHERE c.slug IN ('kanpur', 'lucknow', 'noida', 'gorakhpur')
    AND d.pincode ~ '^[0-9]{6}$'
  GROUP BY c.id, c.name, c.slug, d.pincode
)
INSERT INTO public.service_zones (
  city, city_id, name, slug, status, pincodes,
  center_lat, center_lng, radius_km, services, is_catch_all,
  notes, customer_message
)
SELECT
  area.city,
  area.city_id,
  LEFT(area.area_name, 100) || ' · ' || area.pincode,
  area.city_slug || '-pin-' || area.pincode,
  'AVAILABLE',
  ARRAY[area.pincode]::text[],
  area.center_lat,
  area.center_lng,
  NULL,
  NULL,
  false,
  'Approximate locality grouped from the India Post PIN directory. Refine before using for supplier dispatch boundaries.',
  NULL
FROM postal_areas AS area
WHERE NOT EXISTS (
  SELECT 1
  FROM public.service_zones AS existing
  WHERE (existing.city_id = area.city_id OR LOWER(BTRIM(existing.city)) = LOWER(BTRIM(area.city)))
    AND NOT existing.is_catch_all
    AND area.pincode = ANY(COALESCE(existing.pincodes, ARRAY[]::text[]))
)
ON CONFLICT (slug) DO NOTHING;
