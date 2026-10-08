-- AuroWater: bounded supplier-dispatch recovery index
-- Safe/idempotent. Apply after existing supplier dispatch migrations.
-- Supports the existing 5-minute scheduler without changing dispatch logic.

CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_pending_water_supplier_recovery_idx
  ON public.orders (created_at, last_dispatch_at)
  WHERE status = 'PENDING'
    AND supplier_id IS NULL
    AND service_type = 'water_can';
