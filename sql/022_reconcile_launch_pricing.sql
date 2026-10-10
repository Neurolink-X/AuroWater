-- AuroWater launch pricing reconciliation (forward-only, idempotent).
-- Aligns known legacy seed defaults with the approved launch prices.
-- Preserves values that do not match known legacy defaults (admin customizations).
-- Normal RO ₹20, chilled RO ₹25, recurring RO ₹18; delivery included for water cans.
-- GST is deliberately not changed here; tax treatment requires explicit business/accounting confirmation.

BEGIN;

UPDATE public.settings
SET value = '20'
WHERE key = 'default_can_price'
  AND value IN ('10', '12', '39');

UPDATE public.settings
SET value = '25'
WHERE key = 'chilled_can_price'
  AND value IN ('39', '37', '10', '20');

UPDATE public.settings
SET value = '18'
WHERE key = 'subscription_can_price'
  AND value IN ('10', '37', '39');

UPDATE public.settings
SET value = '20'
WHERE key = 'bulk_can_price'
  AND value IN ('9', '35', '39');

UPDATE public.settings
SET value = '20'
WHERE key = 'market_can_price'
  AND value = '50';

-- Water-can delivery is included; this fee applies only to other service types.
-- Preserve current custom values such as the live ₹10 setting.
UPDATE public.settings
SET value = '10'
WHERE key = 'convenience_fee'
  AND value = '29';

-- Reconcile only the known legacy ₹199 default; preserve custom emergency fees.
UPDATE public.settings
SET value = '30'
WHERE key = 'emergency_surcharge'
  AND value = '199';

-- Add missing launch keys without overwriting existing administrator settings.
INSERT INTO public.settings (key, value) VALUES
  ('default_can_price', '20'),
  ('chilled_can_price', '25'),
  ('subscription_can_price', '18'),
  ('bulk_can_price', '20'),
  ('bulk_threshold', '50'),
  ('market_can_price', '20'),
  ('convenience_fee', '10'),
  ('emergency_surcharge', '30'),
  ('service_base_prices', '{"water_tanker":299,"ro_service":349,"plumbing":149,"borewell":499,"motor_pump":299,"tank_cleaning":599}')
ON CONFLICT (key) DO NOTHING;

-- Keep the service catalog aligned only where its water-can seed is a known legacy value.
UPDATE public.service_types
SET base_price = 20,
    description = 'Sealed 20L drinking-water can; confirm supplier and quality details before ordering'
WHERE key = 'water_can'
  AND base_price IN (10, 12, 39);

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
