-- Private specialist approval and atomic manual assignment.
-- No existing people are auto-approved, and no order is re-assigned during installation.
BEGIN;

CREATE OR REPLACE FUNCTION public.review_partner_technician_application(
  p_application_id uuid, p_admin_id uuid, p_decision text, p_note text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 a public.applications%ROWTYPE;
 p public.profiles%ROWTYPE;
 key text;
 expected_skill text;
 approved_docs integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(
  SELECT 1 FROM public.profiles WHERE id=p_admin_id AND role='admin' AND is_active=true
 ) THEN RAISE EXCEPTION 'Forbidden partner review' USING ERRCODE='42501'; END IF;
 IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='P0001'; END IF;
 SELECT * INTO a FROM public.applications WHERE id=p_application_id FOR UPDATE;
 IF NOT FOUND OR a.type <> 'technician' OR a.status NOT IN ('pending','pending_approval') THEN
  RAISE EXCEPTION 'Application is not pending technician review' USING ERRCODE='P0001';
 END IF;
 SELECT * INTO p FROM public.profiles WHERE id=a.user_id FOR UPDATE;
 IF NOT FOUND OR p.role NOT IN ('customer','technician') OR lower(coalesce(p.status,'')) IN ('suspended','banned') THEN
  RAISE EXCEPTION 'Applicant is not an eligible technician account' USING ERRCODE='P0001';
 END IF;
 IF p_decision='approved' THEN
  key:=CASE a.payload->>'role'
   WHEN 'plumber' THEN 'plumbing'
   WHEN 'borewell' THEN 'borewell'
   WHEN 'tank' THEN 'tank_cleaning'
   WHEN 'ro' THEN 'ro_service'
   WHEN 'motor' THEN 'motor_pump'
   ELSE NULL END;
  expected_skill:=CASE key
   WHEN 'plumbing' THEN 'Plumbing' WHEN 'borewell' THEN 'Boring'
   WHEN 'tank_cleaning' THEN 'Maintenance' WHEN 'ro_service' THEN 'RO Install'
   WHEN 'motor_pump' THEN 'Maintenance' ELSE NULL END;
  IF key IS NULL OR NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements_text(coalesce(a.payload->'skills','[]'::jsonb)) skill
    WHERE skill=expected_skill
  ) THEN RAISE EXCEPTION 'Application role and skill do not match' USING ERRCODE='P0001'; END IF;
  -- The admin verifies identity and skill documents BEFORE granting eligibility.
  SELECT count(DISTINCT document_slot) INTO approved_docs FROM public.user_files
   WHERE owner_user_id=a.user_id AND review_status='approved'
     AND document_slot IN ('aadhaar_front','aadhaar_back','skill_certificate');
  IF approved_docs < 3 THEN
   RAISE EXCEPTION 'Approved identity and skill documents required' USING ERRCODE='P0001';
  END IF;
  UPDATE public.profiles SET role='technician', verification_status='approved', status='active',
    is_active=true, approved_at=now(), approved_by=p_admin_id, updated_at=now()
   WHERE id=a.user_id;
  INSERT INTO public.technician_service_capabilities(
   technician_id,service_key,status,reviewed_by,reviewed_at
  ) VALUES(a.user_id,key,'approved',p_admin_id,now())
  ON CONFLICT (technician_id,service_key) DO UPDATE SET
   status='approved',reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at;
 ELSIF length(trim(coalesce(p_note,''))) < 3 THEN
  RAISE EXCEPTION 'Rejection reason required' USING ERRCODE='P0001';
 END IF;
 UPDATE public.applications SET status=p_decision, rejection_note=CASE WHEN p_decision='rejected' THEN p_note ELSE NULL END,
  reviewed_by=p_admin_id,reviewed_at=now(),updated_at=now() WHERE id=p_application_id;
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,meta)
 VALUES(p_admin_id,'partner.technician_application_'||p_decision,'applications',
  p_application_id::text,jsonb_build_object('applicant',a.user_id,'decision',p_decision,'skill',key,'note',left(coalesce(p_note,''),300)));
 RETURN jsonb_build_object('application_id',a.id,'status',p_decision,'service_key',key);
END;
$$;
REVOKE ALL ON FUNCTION public.review_partner_technician_application(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_partner_technician_application(uuid,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.review_technician_capability(
 p_admin_id uuid,p_technician_id uuid,p_service_key text,p_status text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 p public.profiles%ROWTYPE;
 old_status text;
 doc_count integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id=p_admin_id AND role='admin' AND is_active=true
 ) THEN RAISE EXCEPTION 'Forbidden capability review' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('approved','rejected','suspended') OR
    p_service_key NOT IN ('plumbing','ro_service','borewell','tank_cleaning','motor_pump','installation','maintenance') OR
    length(trim(coalesce(p_reason,'')))<3
 THEN RAISE EXCEPTION 'Invalid capability review' USING ERRCODE='P0001'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=p_technician_id FOR UPDATE;
 IF NOT FOUND OR p.role <> 'technician' THEN RAISE EXCEPTION 'Technician account missing' USING ERRCODE='P0001'; END IF;
 IF p_status='approved' THEN
  IF p.is_active IS DISTINCT FROM true OR p.status <> 'active' OR p.verification_status <> 'approved' THEN
   RAISE EXCEPTION 'Only verified active technicians can be approved' USING ERRCODE='P0001';
  END IF;
  SELECT count(DISTINCT document_slot) INTO doc_count FROM public.user_files
   WHERE owner_user_id=p_technician_id AND review_status='approved'
    AND document_slot IN ('aadhaar_front','aadhaar_back','skill_certificate');
  IF doc_count < 3 THEN RAISE EXCEPTION 'Identity and skill documents must be verified' USING ERRCODE='P0001'; END IF;
 END IF;
 SELECT status INTO old_status FROM public.technician_service_capabilities
  WHERE technician_id=p_technician_id AND service_key=p_service_key FOR UPDATE;
 INSERT INTO public.technician_service_capabilities(technician_id,service_key,status,reviewed_by,reviewed_at)
 VALUES(p_technician_id,p_service_key,p_status,p_admin_id,now())
 ON CONFLICT(technician_id,service_key) DO UPDATE SET
  status=excluded.status,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at;
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,meta)
 VALUES(p_admin_id,'technician.capability_review','technician_service_capabilities',p_technician_id::text,
 jsonb_build_object('service_key',p_service_key,'previous_status',old_status,'new_status',p_status,'reason',left(p_reason,300)));
 RETURN jsonb_build_object('technician_id',p_technician_id,'service_key',p_service_key,'status',p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.review_technician_capability(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_technician_capability(uuid,uuid,text,text,text) TO service_role;

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

-- Manual Admin reassignment happens in one transaction and preserves the dispatch offer ledger.
CREATE OR REPLACE FUNCTION public.admin_assign_specialist(
 p_order_id uuid,p_technician_id uuid,p_admin_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 o public.orders%ROWTYPE;
 p public.profiles%ROWTYPE;
 existing_status text;
 active_jobs integer;
 customer_city text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id=p_admin_id AND role='admin' AND is_active=true
 ) THEN RAISE EXCEPTION 'Forbidden specialist assignment' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status NOT IN ('PENDING','ASSIGNED') THEN
  RAISE EXCEPTION 'Order is no longer assignable' USING ERRCODE='P0001'; END IF;
 IF o.technician_id=p_technician_id AND o.status='ASSIGNED' THEN
  RETURN jsonb_build_object('order_id',o.id,'technician_id',p_technician_id,'already_assigned',true);
 END IF;
 IF o.technician_id IS NOT NULL THEN
   SELECT status INTO existing_status FROM public.technician_job_dispatch
    WHERE order_id=o.id AND technician_id=o.technician_id FOR UPDATE;
   IF existing_status IS DISTINCT FROM 'OFFERED' OR o.accepted_at IS NOT NULL OR o.service_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Accepted or active jobs cannot be reassigned' USING ERRCODE='P0001';
   END IF;
 END IF;
 SELECT * INTO p FROM public.profiles WHERE id=p_technician_id FOR UPDATE;
 IF NOT FOUND OR p.role<>'technician' OR p.status<>'active' OR p.is_active IS DISTINCT FROM true
    OR p.verification_status<>'approved' OR lower(coalesce(p.availability_status,'available')) NOT IN ('available','online')
 THEN RAISE EXCEPTION 'Technician not verified and available' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.technician_service_capabilities
  WHERE technician_id=p_technician_id AND service_key=o.service_type AND status='approved') THEN
  RAISE EXCEPTION 'Technician has no approval for this service' USING ERRCODE='P0001';
 END IF;
 SELECT count(*) INTO active_jobs FROM public.orders WHERE technician_id=p_technician_id
  AND status IN ('ASSIGNED','IN_PROGRESS') AND id<>p_order_id;
 IF active_jobs>=3 THEN RAISE EXCEPTION 'Technician has reached job capacity' USING ERRCODE='P0001'; END IF;
 customer_city := NULLIF(trim(coalesce(o.address_snapshot->>'city','')),'');
 IF customer_city IS NULL AND o.address_id IS NOT NULL THEN
  SELECT city INTO customer_city FROM public.addresses WHERE id=o.address_id;
 END IF;
 IF customer_city IS NULL OR lower(trim(coalesce(p.city,'')))<>lower(trim(customer_city)) THEN
  RAISE EXCEPTION 'Technician is outside customer service city' USING ERRCODE='P0001';
 END IF;
 IF o.technician_id IS NOT NULL THEN
  UPDATE public.technician_job_dispatch SET status='CANCELLED',reason='admin_reassigned',responded_at=now()
   WHERE order_id=o.id AND technician_id=o.technician_id AND status='OFFERED';
 END IF;
 INSERT INTO public.technician_job_dispatch(order_id,technician_id,status,created_at)
 VALUES(o.id,p_technician_id,'OFFERED',now()) ON CONFLICT(order_id,technician_id) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'Technician already offered this job' USING ERRCODE='P0001'; END IF;
 UPDATE public.orders SET technician_id=p_technician_id,status='ASSIGNED',
   assigned_at=now(),last_technician_dispatch_at=now(),
   technician_dispatch_attempts=coalesce(technician_dispatch_attempts,0)+1
 WHERE id=o.id;
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,meta)
 VALUES(p_admin_id,'technician.admin_assigned','orders',o.id::text,
  jsonb_build_object('service',o.service_type,'new_technician',p_technician_id,'old_technician',o.technician_id));
 RETURN jsonb_build_object('order_id',o.id,'technician_id',p_technician_id,'service_key',o.service_type,'already_assigned',false);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_assign_specialist(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_specialist(uuid,uuid,uuid) TO service_role;

COMMIT;