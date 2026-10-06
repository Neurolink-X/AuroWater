-- AuroWater — supplier marketplace base tables
-- Migration: 007_supplier_base.sql
-- Creates supplier settings, stock, milestones and audit primitives used by later application code.

BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_settings (
  user_id          UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_online        BOOLEAN NOT NULL DEFAULT false,
  price_per_can    NUMERIC(10,2) NOT NULL DEFAULT 12,
  service_radius   INTEGER NOT NULL DEFAULT 5,
  zone_radius_km   INTEGER NOT NULL DEFAULT 5,
  commission_rate  NUMERIC(4,2) NOT NULL DEFAULT 8.00,
  is_primary_zone  BOOLEAN NOT NULL DEFAULT false,
  auto_accept      BOOLEAN NOT NULL DEFAULT false,
  upi_id           TEXT,
  bank_account     TEXT,
  ifsc             TEXT,
  qr_code_url      TEXT,
  last_online_at   TIMESTAMPTZ,
  total_earned     NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_payout   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_stock (
  supplier_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cans_available  INTEGER NOT NULL DEFAULT 0,
  low_stock_alert INTEGER NOT NULL DEFAULT 10,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier         TEXT NOT NULL,
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bonus_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notified     BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS completed_orders INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_tier TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
  ADD COLUMN IF NOT EXISTS service_area_km INTEGER,
  ADD COLUMN IF NOT EXISTS pincode TEXT;

CREATE INDEX IF NOT EXISTS idx_supplier_settings_online
  ON public.supplier_settings(is_online);

CREATE INDEX IF NOT EXISTS idx_supplier_stock_supplier
  ON public.supplier_stock(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_milestones_supplier
  ON public.supplier_milestones(supplier_id, unlocked_at DESC);

ALTER TABLE public.supplier_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_settings_select_own_or_admin" ON public.supplier_settings;
CREATE POLICY "supplier_settings_select_own_or_admin" ON public.supplier_settings
  FOR SELECT USING (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_settings_update_own_or_admin" ON public.supplier_settings;
CREATE POLICY "supplier_settings_update_own_or_admin" ON public.supplier_settings
  FOR UPDATE USING (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_settings_insert_own_or_admin" ON public.supplier_settings;
CREATE POLICY "supplier_settings_insert_own_or_admin" ON public.supplier_settings
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_stock_select_own_or_admin" ON public.supplier_stock;
CREATE POLICY "supplier_stock_select_own_or_admin" ON public.supplier_stock
  FOR SELECT USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_stock_update_own_or_admin" ON public.supplier_stock;
CREATE POLICY "supplier_stock_update_own_or_admin" ON public.supplier_stock
  FOR UPDATE USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_stock_insert_own_or_admin" ON public.supplier_stock;
CREATE POLICY "supplier_stock_insert_own_or_admin" ON public.supplier_stock
  FOR INSERT WITH CHECK (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_milestones_select_own_or_admin" ON public.supplier_milestones;
CREATE POLICY "supplier_milestones_select_own_or_admin" ON public.supplier_milestones
  FOR SELECT USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_milestones_insert_admin" ON public.supplier_milestones;
CREATE POLICY "supplier_milestones_insert_admin" ON public.supplier_milestones
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

CREATE OR REPLACE FUNCTION public.sync_supplier_radius()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.zone_radius_km IS NOT NULL THEN
    NEW.service_radius := NEW.zone_radius_km;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supplier_settings_sync_radius ON public.supplier_settings;
CREATE TRIGGER supplier_settings_sync_radius
  BEFORE INSERT OR UPDATE ON public.supplier_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_supplier_radius();

DROP TRIGGER IF EXISTS supplier_settings_updated_at ON public.supplier_settings;
CREATE TRIGGER supplier_settings_updated_at
  BEFORE UPDATE ON public.supplier_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.init_supplier_marketplace_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'supplier' THEN
    INSERT INTO public.supplier_settings(user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.supplier_stock(supplier_id)
    VALUES (NEW.id)
    ON CONFLICT (supplier_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_supplier_marketplace_defaults ON public.profiles;
CREATE TRIGGER trg_init_supplier_marketplace_defaults
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.init_supplier_marketplace_defaults();

CREATE OR REPLACE FUNCTION public.increment_supplier_completed_orders(p_supplier_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET completed_orders = completed_orders + 1
  WHERE id = p_supplier_id;
$$;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
