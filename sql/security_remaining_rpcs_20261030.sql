-- SECURITY: remove anonymous access to privileged RPCs without changing
-- legitimate signed-in supplier/technician operations.
-- Verified against live pg_proc signatures on 2026-10-30.
-- Do not revoke current_profile_role() / is_admin(): public RLS predicates
-- depend on these helpers and must continue to work for unauthenticated roles.
BEGIN;

-- A SECURITY DEFINER SQL stats function had no identity guard. Running as
-- the invoker makes orders RLS enforce ownership even for arbitrary UUIDs.
ALTER FUNCTION public.get_customer_stats(uuid) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.get_customer_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_stats(uuid) TO authenticated, service_role;

-- Dispatch engine uses a backend service-role client. Allowing a technician
-- to claim any pending order via a privileged RPC bypasses matchmaking.
REVOKE EXECUTE ON FUNCTION public.try_assign_technician(uuid,uuid,numeric,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_assign_technician(uuid,uuid,numeric,numeric)
  TO service_role;

-- Legitimate authenticated role routes still use these RPCs; deny anon only.
REVOKE EXECUTE ON FUNCTION public.set_supplier_stock(uuid,integer,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_technician_assignment(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_technician_job(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_service_otp(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_service_otp(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_supplier_stock(uuid,integer,integer,integer) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.release_technician_assignment(uuid,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.start_technician_job(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_service_otp(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.verify_service_otp(uuid,text,uuid) TO authenticated,service_role;

-- Trigger functions cannot be invoked directly as RPCs. Remove gratuitous
-- EXECUTE grants; PostgreSQL triggers continue firing under their owner.
REVOKE EXECUTE ON FUNCTION public.award_subscription_loyalty_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_supplier_registration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_order_stock_reservation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_customer_tier() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Post-deploy, verify against pg_proc with has_function_privilege() and
-- test real technician acceptance, supplier stock updates, and server dispatch.
