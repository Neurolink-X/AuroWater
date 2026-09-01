-- Auth approval fields on existing profiles (do not duplicate as user_profiles)
-- Apply in SQL Editor, then: SELECT pg_notify('pgrst', 'reload schema');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT,
  ADD COLUMN IF NOT EXISTS service_area_km INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Allow pending_approval / rejected alongside existing statuses
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'suspended', 'pending', 'pending_approval', 'rejected', 'banned'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  IF v_role IN ('seller') THEN v_role := 'supplier'; END IF;
  IF v_role IN ('agent', 'plumber') THEN v_role := 'technician'; END IF;
  IF v_role NOT IN ('customer', 'supplier', 'technician', 'admin') THEN
    v_role := 'customer';
  END IF;

  v_status := CASE
    WHEN v_role IN ('supplier', 'technician') THEN 'pending_approval'
    ELSE 'active'
  END;

  INSERT INTO public.profiles (id, full_name, email, phone, role, status, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    v_role,
    v_status,
    NEW.raw_user_meta_data->>'city'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT pg_notify('pgrst', 'reload schema');
