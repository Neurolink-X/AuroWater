-- Role-safe radius controls for water suppliers and skilled service partners.
-- Additive: preserve existing radius values; never backfill or silently reduce them.
BEGIN;
CREATE TABLE IF NOT EXISTS public.partner_radius_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.profiles(id),
  service_key text NOT NULL,
  requested_radius_km integer NOT NULL CHECK (requested_radius_km BETWEEN 1 AND 75),
  previous_radius_km integer NOT NULL CHECK (previous_radius_km > 0),
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  admin_note text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_radius_one_pending_idx
 ON public.partner_radius_requests(provider_id,service_key) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS partner_radius_review_idx
 ON public.partner_radius_requests(status,created_at DESC);
ALTER TABLE public.partner_radius_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_radius_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.partner_radius_requests TO service_role;

CREATE TABLE IF NOT EXISTS public.technician_service_radii (
 technician_id uuid NOT NULL REFERENCES public.profiles(id),
 service_key text NOT NULL,
 radius_km integer NOT NULL CHECK (radius_km BETWEEN 1 AND 75),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(technician_id,service_key)
);
ALTER TABLE public.technician_service_radii ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technician_service_radii FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.technician_service_radii TO service_role;

-- Even a direct authenticated Data API write must not bypass a pending
-- expansion request. The trusted admin review RPC uses service_role only.
CREATE OR REPLACE FUNCTION public.guard_partner_radius_expansion()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF (TG_OP='INSERT' OR NEW.zone_radius_km IS DISTINCT FROM OLD.zone_radius_km) AND
    NEW.zone_radius_km > 30 AND auth.role() IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'Delivery radius above 30 km needs admin approval' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_supplier_radius_expansion ON public.supplier_settings;
CREATE TRIGGER guard_supplier_radius_expansion
BEFORE INSERT OR UPDATE ON public.supplier_settings FOR EACH ROW
EXECUTE FUNCTION public.guard_partner_radius_expansion();
REVOKE ALL ON FUNCTION public.guard_partner_radius_expansion() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.review_partner_radius_request(
 p_request_id uuid,p_admin_id uuid,p_decision text,p_note text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 r public.partner_radius_requests%ROWTYPE;
 v_role text;
 v_capability text;
 v_current integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_admin_id AND role='admin' AND is_active=true) THEN
   RAISE EXCEPTION 'Admin only' USING ERRCODE='42501';
 END IF;
 IF p_decision NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='P0001'; END IF;
 SELECT * INTO r FROM public.partner_radius_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'PENDING' THEN RAISE EXCEPTION 'Request already handled' USING ERRCODE='P0001'; END IF;
 SELECT role INTO v_role FROM public.profiles WHERE id=r.provider_id FOR UPDATE;
 IF r.service_key='water_can' AND v_role='supplier' THEN
   IF r.requested_radius_km NOT BETWEEN 31 AND 50 THEN RAISE EXCEPTION 'Invalid supplier radius' USING ERRCODE='P0001'; END IF;
   IF p_decision='APPROVED' THEN
     SELECT zone_radius_km INTO v_current FROM public.supplier_settings WHERE user_id=r.provider_id FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Supplier settings not found' USING ERRCODE='P0001'; END IF;
     IF COALESCE(v_current,10)<>r.previous_radius_km THEN
       RAISE EXCEPTION 'Radius changed since request; request again' USING ERRCODE='P0001';
     END IF;
     UPDATE public.supplier_settings SET zone_radius_km=r.requested_radius_km,updated_at=now() WHERE user_id=r.provider_id;
   END IF;
 ELSIF v_role='technician' AND r.service_key IN ('plumbing','ro_service','motor_pump','borewell','tank_cleaning') THEN
   SELECT status INTO v_capability FROM public.technician_service_capabilities
      WHERE technician_id=r.provider_id AND service_key=r.service_key;
   IF v_capability IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Service approval missing' USING ERRCODE='P0001'; END IF;
   IF (r.service_key IN ('borewell','tank_cleaning') AND r.requested_radius_km NOT BETWEEN 51 AND 75)
      OR (r.service_key NOT IN ('borewell','tank_cleaning') AND r.requested_radius_km NOT BETWEEN 31 AND 50)
   THEN RAISE EXCEPTION 'Invalid service expansion' USING ERRCODE='P0001'; END IF;
   IF p_decision='APPROVED' THEN
     SELECT radius_km INTO v_current FROM public.technician_service_radii
       WHERE technician_id=r.provider_id AND service_key=r.service_key FOR UPDATE;
     v_current:=COALESCE(v_current,CASE WHEN r.service_key IN ('borewell','tank_cleaning') THEN 50 ELSE 15 END);
     IF v_current<>r.previous_radius_km THEN RAISE EXCEPTION 'Radius changed since request' USING ERRCODE='P0001'; END IF;
     INSERT INTO public.technician_service_radii(technician_id,service_key,radius_km)
       VALUES (r.provider_id,r.service_key,r.requested_radius_km)
       ON CONFLICT(technician_id,service_key) DO UPDATE SET radius_km=excluded.radius_km,updated_at=now();
   END IF;
 ELSE
   RAISE EXCEPTION 'Provider or service not authorized' USING ERRCODE='P0001';
 END IF;
 UPDATE public.partner_radius_requests SET status=p_decision,admin_note=NULLIF(left(trim(p_note),500),''),
   reviewed_by=p_admin_id,reviewed_at=now() WHERE id=p_request_id;
 RETURN jsonb_build_object('request_id',p_request_id,'status',p_decision,
   'provider_id',r.provider_id,'service_key',r.service_key,'radius_km',r.requested_radius_km);
END;
$$;
REVOKE ALL ON FUNCTION public.review_partner_radius_request(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_partner_radius_request(uuid,uuid,text,text) TO service_role;

-- Existing atomic assignment must enforce the same per-service radius as API
-- matching and booking readiness; no global 15-km override for specialist roles.
CREATE OR REPLACE FUNCTION public.try_assign_technician(
 p_order_id uuid,p_technician_id uuid,p_distance_km numeric DEFAULT NULL,
 p_trust_score numeric DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 o public.orders; p public.profiles; max_active integer:=3;
 radius_km numeric:=15; active_count integer; now_ts timestamptz:=now();
BEGIN
 IF auth.role()<>'service_role' AND public.current_profile_role()<>'admin'
   AND auth.uid() IS DISTINCT FROM p_technician_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'PENDING' OR o.technician_id IS NOT NULL THEN RETURN false; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=p_technician_id AND role='technician'
   AND is_active=true AND lower(COALESCE(status,''))='active'
   AND (verification_status IS NULL OR lower(verification_status)='approved')
   AND lower(COALESCE(availability_status,'available')) IN ('available','online') FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.technician_service_capabilities
   WHERE technician_id=p_technician_id AND service_key=o.service_type AND status='approved')
 THEN RETURN false; END IF;
 IF lower(trim(COALESCE(p.city,'')))<>lower(trim(COALESCE(o.address_snapshot->>'city','')))
 THEN RETURN false; END IF;
 SELECT COALESCE(NULLIF(value,'')::integer,3) INTO max_active
   FROM public.settings WHERE key='technician_max_active_jobs';
 SELECT COALESCE(t.radius_km,CASE WHEN o.service_type IN ('borewell','tank_cleaning') THEN 50 ELSE 15 END)
   INTO radius_km FROM (SELECT 1) x LEFT JOIN public.technician_service_radii t
   ON t.technician_id=p_technician_id AND t.service_key=o.service_type;
 SELECT count(*) INTO active_count FROM public.orders WHERE technician_id=p_technician_id
   AND status IN ('ASSIGNED','IN_PROGRESS');
 IF active_count>=COALESCE(max_active,3) THEN RETURN false; END IF;
 IF p_distance_km IS NULL OR p_distance_km<0 OR p_distance_km>radius_km THEN RETURN false; END IF;
 INSERT INTO public.technician_job_dispatch(order_id,technician_id,status,distance_km,trust_score,created_at)
 VALUES(p_order_id,p_technician_id,'OFFERED',p_distance_km,p_trust_score,now_ts)
 ON CONFLICT(order_id,technician_id) DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.orders SET technician_id=p_technician_id,status='ASSIGNED',
   assigned_at=COALESCE(assigned_at,now_ts),last_technician_dispatch_at=now_ts,
   technician_dispatch_attempts=COALESCE(technician_dispatch_attempts,0)+1
 WHERE id=p_order_id AND status='PENDING' AND technician_id IS NULL;
 IF NOT FOUND THEN
   UPDATE public.technician_job_dispatch SET status='CANCELLED',responded_at=now_ts,reason='order_no_longer_pending'
   WHERE order_id=p_order_id AND technician_id=p_technician_id AND status='OFFERED';
   RETURN false;
 END IF;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.try_assign_technician(uuid,uuid,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.try_assign_technician(uuid,uuid,numeric,numeric) TO service_role;
COMMIT;