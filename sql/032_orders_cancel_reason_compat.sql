-- Keep admin cancellation compatible with deployed orders schemas.
-- The admin UI writes cancellation notes to cancel_reason, not the optional notes field.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Ensure PostgREST sees the additive schema change without requiring a project restart.
NOTIFY pgrst, 'reload schema';
