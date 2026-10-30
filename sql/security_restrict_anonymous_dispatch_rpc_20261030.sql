-- Restrict privileged dispatch/stock RPCs to signed-in or server roles.
-- PostgreSQL PUBLIC grants are inherited by anon: revoke PUBLIC as well.
-- These RPCs are called by authenticated technician/supplier or server dispatch routes.
-- Do not revoke authenticated here; technician acceptance and supplier stock need it.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.accept_technician_job(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.adjust_supplier_stock(uuid, integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.try_assign_supplier_with_stock(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_technician_job(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_supplier_stock(uuid, integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.try_assign_supplier_with_stock(uuid, uuid, numeric) TO authenticated, service_role;
COMMIT;
