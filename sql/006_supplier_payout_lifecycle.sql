-- Supplier payout request lifecycle.
-- Existing payout rows are preserved. New requests are pending until an authorised
-- payout workflow explicitly marks them paid and sets paid_at.
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.payouts
  DROP CONSTRAINT IF EXISTS payouts_status_check;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_status_check
  CHECK (status IN ('pending', 'approved', 'paid', 'rejected'));

ALTER TABLE public.payouts
  ALTER COLUMN paid_at DROP NOT NULL,
  ALTER COLUMN paid_at DROP DEFAULT;

-- Legacy rows were created with paid_at defaulted even when they were only
-- requests. Do not rewrite historical timestamps automatically; reconcile
-- legacy records manually before treating them as confirmed payments.
