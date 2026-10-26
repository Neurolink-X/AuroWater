-- Add the explicit cancellation reason field used by the admin order UI.
-- Safe to re-run; preserves existing order data and does not disable triggers.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Refresh PostgREST's schema cache so the new column is visible immediately.
NOTIFY pgrst, 'reload schema';
