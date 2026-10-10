-- AuroTap launch price book (forward migration).
-- Run manually in the intended Supabase project after reviewing the target environment.
-- This changes pricing settings only; it does not alter customer profiles, orders or payments.

INSERT INTO public.settings (key, value)
VALUES
  ('default_can_price', '20'),
  ('chilled_can_price', '25'),
  ('subscription_can_price', '18'),
  ('bulk_can_price', '20'),
  ('market_can_price', '20'),
  ('subscription_discount_percent', '10'),
  ('service_base_prices', '{"water_tanker":299,"ro_service":349,"plumbing":149,"borewell":499,"motor_pump":299,"tank_cleaning":599}')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

SELECT pg_notify('pgrst', 'reload schema');
