-- Forward migration: prevent user-editable Auth metadata from granting admin.
-- Safe to apply to existing installations; existing profiles and roles are untouched.
-- Supplier/technician signups remain pending approval; admin promotion stays server-side.

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

  -- Only the invite-protected server flow may promote an account to admin.
  IF v_role NOT IN ('customer', 'supplier', 'technician') THEN
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
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''), ''),
    v_role,
    v_status,
    NEW.raw_user_meta_data->>'city'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');
