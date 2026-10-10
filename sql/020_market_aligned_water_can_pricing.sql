-- Market-aligned pricing defaults for AuroWater.
-- Safe forward migration: only replaces known legacy seed values; customized
-- admin values and supplier-specific prices are preserved.
-- Review and run in Supabase SQL Editor after deploying this branch.

UPDATE public.settings SET value = '20'
WHERE key = 'default_can_price' AND value IN ('12', '10', '39');

UPDATE public.settings SET value = '18'
WHERE key = 'subscription_can_price' AND value IN ('10', '37', '39');

UPDATE public.settings SET value = '20'
WHERE key = 'bulk_can_price' AND value IN ('9', '35', '39');

UPDATE public.settings SET value = '20'
WHERE key = 'market_can_price' AND value = '50';

UPDATE public.settings SET value = '349'
WHERE key = 'ro_service_price' AND value = '199';

UPDATE public.settings SET value = '299'
WHERE key = 'motor_pump_price' AND value = '249';

UPDATE public.settings SET value = '599'
WHERE key = 'tank_cleaning_price' AND value = '349';

UPDATE public.settings
SET value = '{"water_tanker":299,"ro_service":349,"plumbing":149,"borewell":499,"motor_pump":299,"tank_cleaning":599}'
WHERE key = 'service_base_prices'
  AND value LIKE '%"ro_service":199%'
  AND value LIKE '%"motor_pump":249%'
  AND value LIKE '%"tank_cleaning":349%';

UPDATE public.service_types
SET base_price = 39,
    description = 'Sealed 20L drinking-water can; confirm supplier and quality details before ordering'
WHERE key = 'water_can' AND base_price IN (10, 12, 39);

UPDATE public.service_types
SET base_price = 349
WHERE key = 'ro_service' AND base_price = 199;

UPDATE public.service_types
SET base_price = 299
WHERE key = 'motor_pump' AND base_price = 249;

UPDATE public.service_types
SET base_price = 599
WHERE key = 'tank_cleaning' AND base_price = 349;

-- Ensure required pricing keys exist on older installations, without
-- overwriting any current admin-managed value.
INSERT INTO public.settings (key, value) VALUES
  ('default_can_price', '20'),
  ('subscription_can_price', '18'),
  ('bulk_can_price', '20'),
  ('bulk_threshold', '50'),
  ('market_can_price', '20'),
  ('convenience_fee', '10'),
  ('emergency_surcharge', '30'),
  -- gst_rate intentionally omitted: current API uses 0 and tax policy needs confirmation.

  ('service_base_prices', '{"water_tanker":299,"ro_service":349,"plumbing":149,"borewell":499,"motor_pump":299,"tank_cleaning":599}')
ON CONFLICT (key) DO NOTHING;

-- Keep the public API aware of updated settings.
SELECT pg_notify('pgrst', 'reload schema');
