-- Database integrity follow-up. Apply via reviewed migration in a maintenance window.
-- Read-only production checks on 2026-11-02 found zero violating rows.
-- VALIDATE CONSTRAINT scans existing rows; it does not rewrite the table.
-- Keep short lock timeout to fail safely rather than blocking live traffic.
SET lock_timeout = '3s';
SET statement_timeout = '90s';

ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_payment_collector_check;
ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_payment_collected_amount_nonnegative;
ALTER TABLE public.order_dispatch
  VALIDATE CONSTRAINT order_dispatch_supplier_id_fkey;

-- Prevent anonymous RPC access to privileged role-inspection helpers.
-- Authenticated role permissions remain unchanged; review app callers first.
REVOKE EXECUTE ON FUNCTION public.current_profile_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
