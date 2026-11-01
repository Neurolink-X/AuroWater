-- Restore the canonical booking catalog and explicitly configure requested launch cities.
-- Supplier presence is intentionally not a city/service activation prerequisite.
-- Review this operational expansion before applying to production.
BEGIN;

INSERT INTO public.service_types (key, label, description, base_price, is_active)
VALUES
  ('water_can', '20L Water Can', 'Sealed 20L drinking water can delivery', 20, true),
  ('water_tanker', 'Water Tanker', 'Water tanker delivery', 699, true),
  ('ro_service', 'RO Service & Repair', 'RO purifier service, repair and filter maintenance', 349, true),
  ('plumbing', 'Plumbing', 'Plumbing repair and installation', 149, true),
  ('borewell', 'Borewell Services', 'Borewell inspection, repair and drilling quotation', 499, true),
  ('motor_pump', 'Motor Pump Service', 'Motor pump inspection and repair', 299, true),
  ('tank_cleaning', 'Water Tank Cleaning', 'Overhead and underground water tank cleaning', 599, true)
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    base_price = EXCLUDED.base_price,
    is_active = true;

INSERT INTO public.cities (name, slug, state, lat, lng, radius_km, status, is_featured, sort_order)
VALUES ('Noida', 'noida', 'Uttar Pradesh', 28.5355, 77.3910, 25, 'active', true, 4)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    state = EXCLUDED.state,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    radius_km = EXCLUDED.radius_km,
    status = 'active',
    is_featured = true;

UPDATE public.cities
SET status = 'active', is_featured = true
WHERE slug IN ('kanpur', 'lucknow', 'gorakhpur');

-- Keep zones as the city/service source of truth; do not require suppliers to be online.
-- City-wide requests are bounded by the existing 25 km city radius for Noida.
UPDATE public.service_zones
SET status = 'AVAILABLE',
    services = NULL,
    center_lat = CASE WHEN lower(city) = 'noida' THEN 28.5355 ELSE center_lat END,
    center_lng = CASE WHEN lower(city) = 'noida' THEN 77.3910 ELSE center_lng END,
    radius_km = CASE WHEN lower(city) = 'noida' THEN 25 ELSE radius_km END
WHERE lower(city) IN ('kanpur', 'lucknow', 'gorakhpur', 'noida');

COMMIT;
