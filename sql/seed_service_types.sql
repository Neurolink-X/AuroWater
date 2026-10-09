-- AuroWater service catalog seed.
-- Safe for existing production data: only missing canonical service keys are inserted.
-- Existing rows/prices are never overwritten. Run after sql/001_core_schema.sql.

INSERT INTO public.service_types
  (key, name, description, base_price, unit, is_active, sort_order)
VALUES
  ('water_can', '20L Water Can Delivery', 'Sealed drinking-water can delivery to your address', 10.00, 'per can', true, 10),
  ('water_tanker', 'Water Tanker Delivery', 'Bulk water tanker delivery; final quote depends on capacity and location', 299.00, 'per tanker', true, 20),
  ('ro_service', 'RO Service & Repair', 'Water purifier diagnostics, filter service and repairs', 349.00, 'per visit', true, 30),
  ('plumbing', 'Plumbing Services', 'Household plumbing repairs, fittings and leak support', 149.00, 'per visit', true, 40),
  ('borewell', 'Borewell Services', 'Borewell inspection, repair and installation requests', 499.00, 'per service', true, 50),
  ('motor_pump', 'Motor & Submersible Pump Repair', 'Motor and submersible pump diagnostics and repair', 299.00, 'per visit', true, 60),
  ('tank_cleaning', 'Water Tank Cleaning', 'Water tank cleaning and sanitation service', 599.00, 'per tank', true, 70)
ON CONFLICT (key) DO NOTHING;

SELECT pg_notify('pgrst', 'reload schema');
