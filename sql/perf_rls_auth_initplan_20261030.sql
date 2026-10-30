-- Optimize repeated auth identity checks without changing policy logic.
-- PostgreSQL may cache an uncorrelated SELECT auth.uid()/is_admin()
-- once per statement instead of evaluating each call for every table row.
-- Exact policies and expressions verified against live pg_policies 2026-10-30.
BEGIN;

ALTER POLICY order_dispatch_supplier_read ON public.order_dispatch
  USING (supplier_id = (SELECT auth.uid()));

ALTER POLICY technician_dispatch_technician_read ON public.technician_job_dispatch
  USING (technician_id = (SELECT auth.uid()));

ALTER POLICY orders_customer_select ON public.orders
  USING (
    customer_id = (SELECT auth.uid())
    OR supplier_id = (SELECT auth.uid())
    OR technician_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

ALTER POLICY profiles_select_own ON public.profiles
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

COMMIT;

-- On staging: EXPLAIN (ANALYZE, BUFFERS) representative role-scoped reads.
-- Test customer/supplier/technician/admin own reads and cross-account denials.
-- No policy grants, table privileges or role memberships change.
