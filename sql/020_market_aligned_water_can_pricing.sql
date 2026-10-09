-- Market-aligned pricing defaults for AuroWater.
-- Safe forward migration: only replaces known legacy seed values; customized
-- admin values and supplier-specific prices are preserved.
-- Review and run in Supabase SQL Editor after deploying this branch.

UPDATE public.settings SET value = '39'
WHERE key = 'default_can_price' AND value IN ('12', '10');

UPDATE public.settings SET value = '37'
WHERE key = 'subscription_can_price' AND value = '10';

UPDATE public.settings SET value = '35'
WHERE key = 'bulk_can_price' AND value = '9';

UPDATE public.settings SET value = '50'
WHERE key = 'market_can_price' AND value = '20';

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
WHERE key = 'water_can' AND base_price IN (10, 12);

UPDATE public.service_types
SET base_price = 349
WHERE key = 'ro_service' AND base_price = 199;

UPDATE public.service_types
SET base_price = 299
WHERE key = 'motor_pump' AND base_price = 249;

UPDATE public.service_types
SET base_price = 599
WHERE key = 'tank_cleaning' AND base_price = 349;

-- Keep the public API aware of updated settings.
SELECT pg_notify('pgrst', 'reload schema');
