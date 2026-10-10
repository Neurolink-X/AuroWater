-- AuroTap launch price book.
-- For an existing database, prefer the idempotent sql/022_reconcile_launch_pricing.sql
-- migration, which preserves known administrator customizations.
-- This seed is for explicit launch setup and intentionally updates these price keys.

INSERT INTO public.settings (key, value)
VALUES
  ('default_can_price', '20'),
  ('chilled_can_price', '25'),
  ('subscription_can_price', '18'),
  ('bulk_can_price', '20'),
  ('bulk_threshold', '50'),
  ('market_can_price', '20'),
  ('convenience_fee', '10'),
  ('emergency_surcharge', '30'),
  ('subscription_discount_percent', '10'),
  ('service_base_prices', '{"water_tanker":299,"ro_service":349,"plumbing":149,"borewell":499,"motor_pump":299,"tank_cleaning":599}')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

SELECT pg_notify('pgrst', 'reload schema');
