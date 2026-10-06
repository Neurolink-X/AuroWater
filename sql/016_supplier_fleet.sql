-- AuroWater — supplier fleet operations
-- Migration: 016_supplier_fleet.sql
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_fleet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'Bike',
  capacity_cans INTEGER NOT NULL DEFAULT 20 CHECK (capacity_cans > 0 AND capacity_cans <= 5000),
  plate_number TEXT,
  driver_name TEXT,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','in_use','maintenance','offline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_fleet_supplier_status_idx
  ON public.supplier_fleet (supplier_id, status);

ALTER TABLE public.supplier_fleet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_fleet_select_own_or_admin" ON public.supplier_fleet;
CREATE POLICY "supplier_fleet_select_own_or_admin" ON public.supplier_fleet
  FOR SELECT USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_fleet_insert_own_or_admin" ON public.supplier_fleet;
CREATE POLICY "supplier_fleet_insert_own_or_admin" ON public.supplier_fleet
  FOR INSERT WITH CHECK (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_fleet_update_own_or_admin" ON public.supplier_fleet;
CREATE POLICY "supplier_fleet_update_own_or_admin" ON public.supplier_fleet
  FOR UPDATE USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "supplier_fleet_delete_own_or_admin" ON public.supplier_fleet;
CREATE POLICY "supplier_fleet_delete_own_or_admin" ON public.supplier_fleet
  FOR DELETE USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP TRIGGER IF EXISTS supplier_fleet_updated_at ON public.supplier_fleet;
CREATE TRIGGER supplier_fleet_updated_at
  BEFORE UPDATE ON public.supplier_fleet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
