BEGIN;
-- Deploy only after the compatible application code and specialist approval RPC are live.
-- Invariant across *all* writers including existing RPCs: wrong-skilled technician may not
-- receive a newly-assigned job, even if a caller bypasses the JS eligibility check.
CREATE OR REPLACE FUNCTION public.guard_technician_service_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.technician_id IS NOT NULL AND (
   TG_OP='INSERT' OR NEW.technician_id IS DISTINCT FROM OLD.technician_id
   OR NEW.service_type IS DISTINCT FROM OLD.service_type
 ) THEN
   IF NOT EXISTS(
    SELECT 1 FROM public.technician_service_capabilities cap JOIN public.profiles p
       ON p.id=cap.technician_id
    WHERE cap.technician_id=NEW.technician_id AND cap.service_key=NEW.service_type
      AND cap.status='approved' AND p.role='technician'
      AND p.is_active=true AND p.status='active' AND p.verification_status='approved'
   ) THEN RAISE EXCEPTION 'Technician is not approved for booked service' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_verified_technician_assignment ON public.orders;
CREATE TRIGGER orders_verified_technician_assignment
BEFORE INSERT OR UPDATE OF technician_id,service_type ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_technician_service_assignment();


COMMIT;