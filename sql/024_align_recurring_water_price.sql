-- AuroTap: align recurring Normal RO with approved launch price.
-- Forward-only, idempotent. Does not rewrite historical orders or tax fields.
BEGIN;

UPDATE public.settings
SET value = '20', updated_at = now()
WHERE key = 'subscription_can_price'
  AND value IS DISTINCT FROM '20';

INSERT INTO public.settings (key, value)
VALUES ('subscription_can_price', '20')
ON CONFLICT (key) DO NOTHING;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
