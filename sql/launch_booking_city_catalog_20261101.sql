-- Restore the canonical booking catalog and launch citywide coverage in the four requested cities.
-- Supplier matching is asynchronous and must not prevent a customer order from being created.
BEGIN;

INSERT INTO public.service_types (key, label, description, base_price, is_active)
VALUES
  ('water_can', '20L Water Can', 'Sealed 20L drinking water can delivery', 20, true),
  ('water_tanker', 'Water Tanker', 'Water tanker delivery', 299, true),
  ('ro_service', 'RO Service & Repair', 'RO purifier service, repair and filter maintenance', 349, true),
  ('plumbing', 'Plumbing', 'Plumbing repair and installation', 149, true),
  ('borewell', 'Borewell Services', 'Borewell inspection, repair and drilling quotation', 499, true),
  ('motor_pump', 'Motor Pump Service', 'Motor pump inspection and repair', 299, true),
  ('tank_cleaning', 'Water Tank Cleaning', 'Overhead and underground water tank cleaning', 599, true)
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    is_active = true;

-- Activate all requested city records with city-centre coordinates used for fallback
-- geolocation. Full-city serviceability is provided by the catch-all zones below.
INSERT INTO public.cities (name, slug, state, lat, lng, radius_km, status, is_featured, sort_order)
VALUES
  ('Kanpur', 'kanpur', 'Uttar Pradesh', 26.4499, 80.3319, 30, 'active', true, 1),
  ('Lucknow', 'lucknow', 'Uttar Pradesh', 26.8467, 80.9462, 30, 'active', true, 2),
  ('Noida', 'noida', 'Uttar Pradesh', 28.5355, 77.3910, 25, 'active', true, 3),
  ('Gorakhpur', 'gorakhpur', 'Uttar Pradesh', 26.7606, 83.3732, 25, 'active', true, 4)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    state = EXCLUDED.state,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    radius_km = EXCLUDED.radius_km,
    status = 'active',
    is_featured = true,
    sort_order = EXCLUDED.sort_order;

-- Existing neighborhood rows remain useful for analytics, but every requested
-- service is bookable throughout each city. No supplier must be online at checkout.
UPDATE public.service_zones
SET status = 'AVAILABLE',
    services = NULL,
    center_lat = CASE lower(city)
      WHEN 'noida' THEN 28.5355
      WHEN 'kanpur' THEN 26.4499
      WHEN 'lucknow' THEN 26.8467
      WHEN 'gorakhpur' THEN 26.7606
      ELSE center_lat
    END,
    center_lng = CASE lower(city)
      WHEN 'noida' THEN 77.3910
      WHEN 'kanpur' THEN 80.3319
      WHEN 'lucknow' THEN 80.9462
      WHEN 'gorakhpur' THEN 83.3732
      ELSE center_lng
    END,
    radius_km = CASE lower(city)
      WHEN 'noida' THEN 25
      WHEN 'kanpur' THEN 30
      WHEN 'lucknow' THEN 30
      WHEN 'gorakhpur' THEN 25
      ELSE radius_km
    END,
    updated_at = now()
WHERE lower(city) IN ('kanpur', 'lucknow', 'noida', 'gorakhpur');

-- Ensure there is a citywide fallback for pincodes and map points outside listed
-- neighborhood zones. One row per city, safe to rerun by stable unique slug.
INSERT INTO public.service_zones
  (city, city_id, name, slug, status, pincodes, center_lat, center_lng, radius_km, services, is_catch_all, notes)
SELECT
  c.name,
  c.id,
  'All areas',
  c.slug || '-all-areas',
  'AVAILABLE',
  ARRAY[]::text[],
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  'Citywide launch coverage; supplier dispatch may continue after order creation.'
FROM public.cities c
WHERE c.slug IN ('kanpur', 'lucknow', 'noida', 'gorakhpur')
ON CONFLICT (slug) DO UPDATE
SET city = EXCLUDED.city,
    city_id = EXCLUDED.city_id,
    name = EXCLUDED.name,
    status = 'AVAILABLE',
    pincodes = ARRAY[]::text[],
    center_lat = NULL,
    center_lng = NULL,
    radius_km = NULL,
    services = NULL,
    is_catch_all = true,
    notes = EXCLUDED.notes,
    updated_at = now();

COMMIT;
