-- AuroWater payment-status compatibility fix.
-- The application uses 'unpaid' for cash/UPI orders and completion checks.
-- Production currently allows pending/paid/refunded/failed but rejects unpaid.
-- Preserve every existing production value and add 'unpaid'.
BEGIN;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (
    payment_status = ANY (
      ARRAY[
        'pending'::text,
        'unpaid'::text,
        'paid'::text,
        'refunded'::text,
        'failed'::text
      ]
    )
  );

COMMIT;

SELECT pg_notify('pgrst', 'reload schema');
