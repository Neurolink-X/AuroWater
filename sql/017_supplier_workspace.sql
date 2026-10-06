-- 017_supplier_workspace.sql
-- Supplier profile, fleet and document records. Backend is source of truth.
-- Idempotent.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS service_cities TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.supplier_fleet (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  vehicle_name   TEXT,
  vehicle_type   TEXT NOT NULL DEFAULT 'water_tanker',
  capacity_litres INTEGER NOT NULL CHECK (capacity_litres > 0),
  driver_name    TEXT,
  price_per_trip NUMERIC(10,2) CHECK (price_per_trip IS NULL OR price_per_trip >= 0),
  status         TEXT NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','in_use','maintenance','inactive')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, vehicle_number)
);

CREATE INDEX IF NOT EXISTS supplier_fleet_supplier_status_idx
  ON public.supplier_fleet(supplier_id, status);

ALTER TABLE public.supplier_fleet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_fleet_own_or_admin" ON public.supplier_fleet;
CREATE POLICY "supplier_fleet_own_or_admin" ON public.supplier_fleet
  FOR ALL USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP TRIGGER IF EXISTS supplier_fleet_updated_at ON public.supplier_fleet;
CREATE TRIGGER supplier_fleet_updated_at
  BEFORE UPDATE ON public.supplier_fleet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type     TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  file_name         TEXT NOT NULL,
  file_size_bytes   BIGINT NOT NULL CHECK (file_size_bytes > 0),
  mime_type         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'submitted'
                      CHECK (status IN ('submitted','verified','rejected')),
  rejection_reason  TEXT,
  verified_by       UUID REFERENCES public.profiles(id),
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, document_type)
);

CREATE INDEX IF NOT EXISTS supplier_documents_supplier_status_idx
  ON public.supplier_documents(supplier_id, status);

ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_documents_own_or_admin" ON public.supplier_documents;
CREATE POLICY "supplier_documents_own_or_admin" ON public.supplier_documents
  FOR ALL USING (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    supplier_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP TRIGGER IF EXISTS supplier_documents_updated_at ON public.supplier_documents;
CREATE TRIGGER supplier_documents_updated_at
  BEFORE UPDATE ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.update_supplier_profile(
  p_supplier_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_business_name TEXT DEFAULT NULL,
  p_gstin TEXT DEFAULT NULL,
  p_service_cities TEXT[] DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_profile public.profiles;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM p_supplier_id
     AND COALESCE(public.current_profile_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.profiles
  SET
    full_name = CASE WHEN p_full_name IS NULL THEN full_name ELSE NULLIF(TRIM(p_full_name), '') END,
    business_name = CASE WHEN p_business_name IS NULL THEN business_name ELSE NULLIF(TRIM(p_business_name), '') END,
    gstin = CASE WHEN p_gstin IS NULL THEN gstin ELSE NULLIF(UPPER(TRIM(p_gstin)), '') END,
    service_cities = COALESCE(p_service_cities, service_cities)
  WHERE id = p_supplier_id
    AND role = 'supplier'
  RETURNING * INTO updated_profile;

  IF updated_profile.id IS NULL THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND';
  END IF;

  RETURN updated_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_supplier_profile(UUID, TEXT, TEXT, TEXT, TEXT[])
  TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
