-- Run after creating admin user in Supabase Auth UI (schema from sql/001_core_schema.sql)
INSERT INTO public.profiles (id, email, role, full_name, phone)
SELECT id, email, 'admin', 'Arjun', '9889305803'
FROM auth.users
WHERE email = 'Arjunchaurasiya1254@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      updated_at = now();
