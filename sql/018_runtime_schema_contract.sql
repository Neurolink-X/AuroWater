-- AuroWater — runtime schema contract
-- Migration: 018_runtime_schema_contract.sql
-- Aligns the deployable database with the current application field contract.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
  ADD COLUMN IF NOT EXISTS service_area_km INTEGER,
  ADD COLUMN IF NOT EXISTS pincode TEXT;

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS line1 TEXT,
  ADD COLUMN IF NOT EXISTS line2 TEXT;

UPDATE public.addresses
SET customer_id = user_id
WHERE customer_id IS NULL;

UPDATE public.addresses
SET line1 = house_flat
WHERE line1 IS NULL;

UPDATE public.addresses
SET line2 = area
WHERE line2 IS NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_customer_id
  ON public.addresses(customer_id);

CREATE OR REPLACE FUNCTION public.sync_address_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := NEW.user_id;
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS addresses_sync_owner ON public.addresses;
CREATE TRIGGER addresses_sync_owner
  BEFORE INSERT OR UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.sync_address_owner();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS can_count INTEGER,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS supplier_note TEXT,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

UPDATE public.orders o
SET service_type = st.key
FROM public.service_types st
WHERE o.service_type IS NULL
  AND o.service_type_id = st.id;

UPDATE public.orders
SET can_count = can_quantity
WHERE can_count IS NULL
  AND can_quantity IS NOT NULL;

UPDATE public.orders
SET note = notes
WHERE note IS NULL
  AND notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_supplier_status
  ON public.orders(supplier_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_dispatch_state
  ON public.orders(status, assigned_at, last_dispatch_at);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED','FAILED'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_can_frequency_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_can_frequency_check
  CHECK (
    can_frequency IS NULL
    OR can_frequency IN ('daily','alternate','weekly','biweekly','monthly')
  );

CREATE TABLE IF NOT EXISTS public.service_zones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city         TEXT NOT NULL,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'AVAILABLE'
                 CHECK (status IN ('AVAILABLE','LIMITED','TEMPORARILY_UNAVAILABLE','COMING_SOON')),
  pincodes     TEXT[] DEFAULT '{}',
  center_lat   DOUBLE PRECISION,
  center_lng   DOUBLE PRECISION,
  radius_km    DOUBLE PRECISION,
  services     TEXT[],
  is_catch_all BOOLEAN NOT NULL DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(city, slug)
);

CREATE INDEX IF NOT EXISTS service_zones_city_status_idx
  ON public.service_zones(city, status);

ALTER TABLE public.service_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_zones_public_select" ON public.service_zones;
CREATE POLICY "service_zones_public_select" ON public.service_zones
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_zones_admin_write" ON public.service_zones;
CREATE POLICY "service_zones_admin_write" ON public.service_zones
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP TRIGGER IF EXISTS service_zones_updated_at ON public.service_zones;
CREATE TRIGGER service_zones_updated_at
  BEFORE UPDATE ON public.service_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.supplier_zones (
  supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id     UUID NOT NULL REFERENCES public.service_zones(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (supplier_id, zone_id)
);

CREATE INDEX IF NOT EXISTS supplier_zones_zone_idx
  ON public.supplier_zones(zone_id);

ALTER TABLE public.supplier_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_zones_public_select" ON public.supplier_zones;
CREATE POLICY "supplier_zones_public_select" ON public.supplier_zones
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "supplier_zones_admin_write" ON public.supplier_zones;
CREATE POLICY "supplier_zones_admin_write" ON public.supplier_zones
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
