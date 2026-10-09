-- AuroWater water-can pricing rollout.
-- Safe to re-run: updates only pricing settings; does not touch orders or customer data.
-- Apply this migration to the target Supabase project before enabling the new UI.

INSERT INTO public.settings (key, value)
VALUES
  ('default_can_price', '20'),
  ('chilled_can_price', '25'),
  ('subscription_can_price', '20'),
  ('bulk_can_price', '20'),
  ('market_can_price', '20')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

