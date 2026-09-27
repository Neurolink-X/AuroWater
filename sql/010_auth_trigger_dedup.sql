-- One auth.users → profiles trigger (004 and 008 both installed triggers)

DROP TRIGGER IF EXISTS aurowater_on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Public directory: only active technicians, no emails/phones
DROP POLICY IF EXISTS profiles_public_read_technicians ON public.profiles;
CREATE POLICY profiles_public_read_technicians ON public.profiles
  FOR SELECT
  USING (role = 'technician' AND is_active = true);

SELECT pg_notify('pgrst', 'reload schema');
