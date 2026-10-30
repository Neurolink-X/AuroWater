-- Unify city and NCR expansion demand capture in public.city_waitlist.
-- Safe for existing records; keeps the existing admin/RLS workflow intact.
BEGIN;

ALTER TABLE public.city_waitlist
  ALTER COLUMN phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_email_created
  ON public.city_waitlist (lower(email), created_at DESC)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_custom_city_created
  ON public.city_waitlist (lower(custom_city), created_at DESC)
  WHERE custom_city IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
