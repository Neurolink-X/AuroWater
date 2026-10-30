-- Area-first city waitlist support.
-- Existing city_waitlist rows are preserved; area and pincode remain optional for legacy signups.
BEGIN;

ALTER TABLE public.city_waitlist
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_email_created
  ON public.city_waitlist (lower(email), created_at DESC)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_city_area_created
  ON public.city_waitlist (lower(custom_city), lower(area), created_at DESC)
  WHERE custom_city IS NOT NULL AND area IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_city_waitlist_pincode_created
  ON public.city_waitlist (pincode, created_at DESC)
  WHERE pincode IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
