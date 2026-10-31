-- Additional database guard for published pricing versions.
-- Admin UI + API already validate, but direct RPC calls must not bypass
-- the ₹20 normal/subscription/bulk and ₹25 chilled customer price floors.
-- Existing versions remain immutable and unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_pricing_version_floors()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $body$
DECLARE
  book jsonb;
  city_key text;
BEGIN
  -- Validate the global book and every complete city-specific price book.
  FOR city_key, book IN
    SELECT 'global'::text, NEW.config
    UNION ALL
    SELECT key, value FROM jsonb_each(
      CASE WHEN jsonb_typeof(NEW.config -> 'city_overrides') = 'object'
        THEN NEW.config -> 'city_overrides' ELSE '{}'::jsonb END
    )
  LOOP
    IF jsonb_typeof(book) <> 'object'
      OR jsonb_typeof(book->'services') <> 'object'
      OR coalesce((book->>'water_normal')::numeric, -1) < 20
      OR coalesce((book->>'water_chilled')::numeric, -1) < 25
      OR coalesce((book->>'water_subscription')::numeric, -1) < 20
      OR coalesce((book->>'bulk_can_price')::numeric, -1) < 20
      OR coalesce((book->>'bulk_can_price')::numeric, 999999) >
         coalesce((book->>'water_normal')::numeric, -1)
      OR coalesce((book->>'convenience_fee')::numeric, -1) < 0
      OR coalesce((book->>'emergency_surcharge')::numeric, -1) < 0
      OR coalesce((book->>'gst_rate')::numeric, -1) NOT BETWEEN 0 AND 1
    THEN
      RAISE EXCEPTION 'Invalid pricing policy for %: minimum normal/subscription/bulk ₹20, chilled ₹25; all fees must be nonnegative',
        city_key USING ERRCODE='22023';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS pricing_version_floor_guard ON public.pricing_versions;
CREATE TRIGGER pricing_version_floor_guard
  BEFORE INSERT ON public.pricing_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_pricing_version_floors();

REVOKE ALL ON FUNCTION public.guard_pricing_version_floors() FROM PUBLIC, anon, authenticated;
COMMIT;
