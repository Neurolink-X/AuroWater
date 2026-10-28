-- Enforce AuroTap's approved water-can price floors for every newly published pricing version.
-- Normal RO / subscription / bulk: at least ₹20 per 20L can.
-- Chilled RO: at least ₹25 per 20L can.
-- Existing immutable pricing history and order snapshots are not rewritten.
BEGIN;

-- Normalize legacy settings for future UI reads and bookings. Historical orders are untouched.
UPDATE public.settings
SET value = '20', updated_at = now()
WHERE key IN ('default_can_price', 'subscription_can_price', 'bulk_can_price', 'min_can_price', 'max_can_price')
  AND value ~ '^[0-9]+([.][0-9]+)? public.enforce_pricing_version_water_floors()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normal_price NUMERIC;
  chilled_price NUMERIC;
  subscription_price NUMERIC;
  bulk_price NUMERIC;
BEGIN
  normal_price := (NEW.config->>'water_normal')::numeric;
  chilled_price := (NEW.config->>'water_chilled')::numeric;
  subscription_price := (NEW.config->>'water_subscription')::numeric;
  bulk_price := (NEW.config->>'bulk_can_price')::numeric;

  IF normal_price IS NULL OR normal_price < 20 THEN
    RAISE EXCEPTION 'Normal RO must be at least ₹20 per 20L can';
  END IF;
  IF chilled_price IS NULL OR chilled_price < 25 THEN
    RAISE EXCEPTION 'Chilled RO must be at least ₹25 per 20L can';
  END IF;
  IF subscription_price IS NULL OR subscription_price < 20 THEN
    RAISE EXCEPTION 'Subscription RO must be at least ₹20 per 20L can';
  END IF;
  IF bulk_price IS NULL OR bulk_price < 20 THEN
    RAISE EXCEPTION 'Bulk RO must be at least ₹20 per 20L can';
  END IF;
  IF bulk_price > normal_price THEN
    RAISE EXCEPTION 'Bulk RO cannot exceed the normal RO per-can price';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pricing_versions_water_floors ON public.pricing_versions;
CREATE TRIGGER pricing_versions_water_floors
  BEFORE INSERT ON public.pricing_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pricing_version_water_floors();

COMMIT;

  AND value::numeric < 20;

UPDATE public.settings
SET value = '25', updated_at = now()
WHERE key = 'chilled_can_price'
  AND value ~ '^[0-9]+([.][0-9]+)? public.enforce_pricing_version_water_floors()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normal_price NUMERIC;
  chilled_price NUMERIC;
  subscription_price NUMERIC;
  bulk_price NUMERIC;
BEGIN
  normal_price := (NEW.config->>'water_normal')::numeric;
  chilled_price := (NEW.config->>'water_chilled')::numeric;
  subscription_price := (NEW.config->>'water_subscription')::numeric;
  bulk_price := (NEW.config->>'bulk_can_price')::numeric;

  IF normal_price IS NULL OR normal_price < 20 THEN
    RAISE EXCEPTION 'Normal RO must be at least ₹20 per 20L can';
  END IF;
  IF chilled_price IS NULL OR chilled_price < 25 THEN
    RAISE EXCEPTION 'Chilled RO must be at least ₹25 per 20L can';
  END IF;
  IF subscription_price IS NULL OR subscription_price < 20 THEN
    RAISE EXCEPTION 'Subscription RO must be at least ₹20 per 20L can';
  END IF;
  IF bulk_price IS NULL OR bulk_price < 20 THEN
    RAISE EXCEPTION 'Bulk RO must be at least ₹20 per 20L can';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pricing_versions_water_floors ON public.pricing_versions;
CREATE TRIGGER pricing_versions_water_floors
  BEFORE INSERT ON public.pricing_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pricing_version_water_floors();

COMMIT;

  AND value::numeric < 25;

CREATE OR REPLACE FUNCTION public.enforce_pricing_version_water_floors()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normal_price NUMERIC;
  chilled_price NUMERIC;
  subscription_price NUMERIC;
  bulk_price NUMERIC;
BEGIN
  normal_price := (NEW.config->>'water_normal')::numeric;
  chilled_price := (NEW.config->>'water_chilled')::numeric;
  subscription_price := (NEW.config->>'water_subscription')::numeric;
  bulk_price := (NEW.config->>'bulk_can_price')::numeric;

  IF normal_price IS NULL OR normal_price < 20 THEN
    RAISE EXCEPTION 'Normal RO must be at least ₹20 per 20L can';
  END IF;
  IF chilled_price IS NULL OR chilled_price < 25 THEN
    RAISE EXCEPTION 'Chilled RO must be at least ₹25 per 20L can';
  END IF;
  IF subscription_price IS NULL OR subscription_price < 20 THEN
    RAISE EXCEPTION 'Subscription RO must be at least ₹20 per 20L can';
  END IF;
  IF bulk_price IS NULL OR bulk_price < 20 THEN
    RAISE EXCEPTION 'Bulk RO must be at least ₹20 per 20L can';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pricing_versions_water_floors ON public.pricing_versions;
CREATE TRIGGER pricing_versions_water_floors
  BEFORE INSERT ON public.pricing_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pricing_version_water_floors();

COMMIT;
