-- Align initial partner activation with technician-dashboard KYC:
-- Aadhaar front/back and a real profile photo are mandatory. Training/trade
-- certificate is optional if verified work experience is documented by admin.
-- IMPORTANT: later capability expansion still requires stronger skill evidence.
-- Existing approvals and records are unchanged; do not run without staging CI.
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
  -- Three verified identity/profile images are mandatory. A skill certificate
  -- is optional for experienced trade workers, but the admin MUST write a
  -- concrete record of the experience/reference check before approval.
  IF length(trim(coalesce(p_note,''))) < 20 THEN
    RAISE EXCEPTION 'Describe your identity and skill/experience verification in at least 20 characters' USING ERRCODE='P0001';
  END IF;
  -- Keep this check within the same row-locked, audited transaction.
  SELECT count(DISTINCT document_slot) INTO approved_docs FROM public.user_files
   WHERE owner_user_id=a.user_id AND review_status='approved'
     AND document_slot IN ('aadhaar_front','aadhaar_back','profile_photo');
  IF approved_docs < 3 THEN
   RAISE EXCEPTION 'Approved identity photos and profile photo are required' USING ERRCODE='P0001';
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

COMMIT;
