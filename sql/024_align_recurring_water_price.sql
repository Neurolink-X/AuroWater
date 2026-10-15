-- AuroTap: align recurring Normal RO with approved launch price.
-- Forward-only, idempotent. Does not rewrite historical orders or tax fields.
-- Active subscriptions using the previous ₹18 rate are aligned for future deliveries.
BEGIN;

UPDATE public.settings
SET value = '20', updated_at = now()
WHERE key = 'subscription_can_price'
  AND value IS DISTINCT FROM '20';

INSERT INTO public.settings (key, value)
VALUES ('subscription_can_price', '20')
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.water_subscriptions') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'water_subscriptions'
         AND column_name = 'price_per_can'
     )
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'water_subscriptions'
         AND column_name = 'status'
     )
  THEN
    EXECUTE $update$
      UPDATE public.water_subscriptions
      SET price_per_can = 20
      WHERE status = 'ACTIVE'
        AND price_per_can = 18
    $update$;
  END IF;
END
$$;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
