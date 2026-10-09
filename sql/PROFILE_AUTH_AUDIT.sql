-- READ-ONLY audit: compare Supabase Auth identity with the application profile.
-- Run in Supabase SQL Editor using a role allowed to read auth.users and public.profiles.
-- This script does not insert, update, delete, or alter any data.

SELECT
  u.id AS auth_user_id,
  u.email AS auth_email,
  NULLIF(u.phone, '') AS auth_phone,
  COALESCE(u.raw_app_meta_data->'providers', '[]'::jsonb) AS auth_providers,
  NULLIF(p.phone, '') AS profile_phone,
  p.role AS application_role,
  p.status AS profile_status,
  p.is_active,
  CASE
    WHEN p.id IS NULL THEN 'MISSING_PROFILE'
    WHEN p.role IS NULL THEN 'MISSING_ROLE'
    WHEN NULLIF(BTRIM(p.phone), '') IS NULL THEN 'PHONE_MISSING'
    ELSE 'OK'
  END AS audit_result,
  u.created_at AS auth_created_at,
  p.created_at AS profile_created_at
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
ORDER BY u.created_at DESC;

-- Optional: identify duplicate non-empty profile phone numbers before considering
-- any unique index. This is also read-only.
SELECT
  REGEXP_REPLACE(phone, '\D', '', 'g') AS normalized_phone,
  COUNT(*) AS account_count,
  ARRAY_AGG(id ORDER BY created_at) AS profile_ids
FROM public.profiles
WHERE NULLIF(BTRIM(phone), '') IS NOT NULL
GROUP BY REGEXP_REPLACE(phone, '\D', '', 'g')
HAVING COUNT(*) > 1
ORDER BY account_count DESC;
