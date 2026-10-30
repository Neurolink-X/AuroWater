-- Unify city and NCR expansion demand capture in public.city_waitlist.
-- Safe for existing records; keeps the existing admin/RLS workflow intact.
BEGIN;

ALTER TABLE public.city_waitlist
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT;

ALTER TABLE public.city_waitlist
  ADD CONSTRAINT city_waitlist_pincode_format
  CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}

CREATE INDEX IF NOT EXISTS idx_city_waitlist_email_created
  ON public.city_waitlist (lower(email), created_at DESC)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_area_created
  ON public.city_waitlist (lower(custom_city), lower(area), created_at DESC)
  WHERE area IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_custom_city_created
  ON public.city_waitlist (lower(custom_city), created_at DESC)
  WHERE custom_city IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_email_created
  ON public.city_waitlist (lower(email), created_at DESC)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_custom_city_created
  ON public.city_waitlist (lower(custom_city), created_at DESC)
  WHERE custom_city IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
