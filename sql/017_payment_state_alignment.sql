-- AuroWater — payment state alignment
-- Migration: 017_payment_state_alignment.sql
-- The application uses pending/paid/failed/refunded/cancelled.

BEGIN;

UPDATE public.orders
SET payment_status = 'pending'
WHERE payment_status = 'unpaid';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending','paid','failed','refunded','cancelled'));

ALTER TABLE public.orders
  ALTER COLUMN payment_status SET DEFAULT 'pending';

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
