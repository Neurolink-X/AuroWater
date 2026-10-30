-- Apply only after verifying that authenticated supplier/technician sessions
-- can SELECT their own orders and associated customer profile through RLS.
-- security_invoker preserves the existing security_barrier and view SQL.
-- This prevents the view owner's privileges from bypassing underlying RLS.
BEGIN;
ALTER VIEW public.supplier_orders_masked SET (security_invoker = true);
ALTER VIEW public.technician_orders_masked SET (security_invoker = true);
COMMIT;

-- Verification:
-- SELECT relname, reloptions FROM pg_class WHERE oid IN
-- ('public.supplier_orders_masked'::regclass,'public.technician_orders_masked'::regclass);
-- Test authenticated supplier/technician own-order reads and cross-user denial.
