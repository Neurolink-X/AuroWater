-- AuroTap — Customer order history performance
-- Migration: 013_customer_orders_performance.sql
-- Safe to run more than once.

-- Main history query:
--   WHERE customer_id = ?
--   ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS
  orders_customer_created_at_idx
ON public.orders (
  customer_id,
  created_at DESC
);

-- Filtered history tabs:
--   WHERE customer_id = ? AND status = ?
--   ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS
  orders_customer_status_created_at_idx
ON public.orders (
  customer_id,
  status,
  created_at DESC
);

SELECT pg_notify(
  'pgrst',
  'reload schema'
);
