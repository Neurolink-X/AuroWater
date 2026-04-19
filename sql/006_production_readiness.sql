-- sql/006_production_readiness.sql
-- Run AFTER sql/006_schema_compat.sql (or paste after full bundle).
-- Idempotent: no DROP, no RLS replacement (002_rls_policies.sql stays authoritative).

-- ── Ensure profile display IDs for existing rows ─────────────────────────
UPDATE public.profiles
SET aurotap_id = 'AW-' || upper(left(replace(id::text, '-', ''), 8))
WHERE aurotap_id IS NULL OR trim(both from aurotap_id) = '';

-- ── Service catalogue: bump metadata if seeds changed (matches app keys) ─
INSERT INTO public.service_types (key, name, description, base_price, unit, is_active, sort_order)
VALUES
  ('water_can', 'Water Can (20L)', 'RO-purified 20L cans', 12, 'per can', true, 1),
  ('water_tanker', 'Water Tanker', 'Bulk water delivery', 299, 'per delivery', true, 2),
  ('ro_service', 'RO Service & Repair', 'RO purifier service and repair', 199, 'per visit', true, 3),
  ('plumbing', 'Plumbing', 'Pipe fitting and repair', 149, 'per visit', true, 4),
  ('borewell', 'Borewell Services', 'Drilling and repair', 499, 'per service', true, 5),
  ('motor_pump', 'Motor & Pump Repair', 'Pump installation/repair', 249, 'per visit', true, 6),
  ('tank_cleaning', 'Water Tank Cleaning', 'Tank cleaning', 349, 'per tank', true, 7)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  unit = EXCLUDED.unit,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- ── Reload PostgREST schema cache ───────────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');

-- ── Verification (expect 8 rows when core migration applied) ─────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'orders', 'addresses', 'service_types',
    'settings', 'notifications', 'reviews', 'payouts'
  )
ORDER BY table_name;
