-- Existing technicians must NEVER be redirected to supplier/first-time signup.
-- Safe, auditable service-only request from already authenticated technician role.
-- Does not promote roles or create job entitlements until admin review.
-- The index applies ONLY to technician applications, avoiding legacy supplier rows.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS technician_one_pending_application_idx
  ON public.applications (user_id,type)
  WHERE type='technician' AND status IN ('pending','pending_approval');

CREATE OR REPLACE FUNCTION public.submit_technician_service_request(
  p_user_id uuid, p_service_key text, p_working_area text,
  p_working_pincode text, p_experience_years integer,
  p_work_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  account public.profiles%ROWTYPE;
  requested_role text;
  expected_skill text;
  radius_km integer;
  latest_approved integer;
  pending public.applications%ROWTYPE;
  created public.applications%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the authenticated professional API can submit requests'
      USING ERRCODE='42501';
  END IF;
  IF p_service_key NOT IN ('plumbing','ro_service','tank_cleaning','borewell')
    OR p_experience_years NOT BETWEEN 0 AND 60
    OR length(trim(coalesce(p_working_area,''))) NOT BETWEEN 3 AND 150
    OR coalesce(p_working_pincode,'') !~ '^[1-9][0-9]{5}$'
    OR length(trim(coalesce(p_work_description,''))) NOT BETWEEN 20 AND 700
  THEN RAISE EXCEPTION 'Invalid service application details' USING ERRCODE='P0001'; END IF;

  requested_role:=CASE p_service_key
    WHEN 'plumbing' THEN 'plumber'
    WHEN 'ro_service' THEN 'ro'
    WHEN 'tank_cleaning' THEN 'tank'
    WHEN 'borewell' THEN 'borewell' END;
  expected_skill:=CASE p_service_key
    WHEN 'plumbing' THEN 'Plumbing'
    WHEN 'ro_service' THEN 'RO Install'
    WHEN 'tank_cleaning' THEN 'Maintenance'
    WHEN 'borewell' THEN 'Boring' END;
  radius_km:=CASE p_service_key
    WHEN 'tank_cleaning' THEN 50 WHEN 'borewell' THEN 50 ELSE 15 END;

  -- Serializes concurrent requests from this same user.
  SELECT * INTO account FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND OR account.role<>'technician' OR account.status<>'active'
    OR account.is_active IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'An active technician account is required' USING ERRCODE='P0001'; END IF;
  IF nullif(trim(coalesce(account.full_name,'')),'') IS NULL
    OR nullif(trim(coalesce(account.city,'')),'') IS NULL
  THEN RAISE EXCEPTION 'Complete your name and registered city first' USING ERRCODE='P0001'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.technician_service_capabilities
    WHERE technician_id=p_user_id AND service_key=p_service_key AND status='approved'
  ) THEN RAISE EXCEPTION 'This service is already approved' USING ERRCODE='P0001'; END IF;

  SELECT count(*) INTO latest_approved FROM (
    SELECT DISTINCT ON (document_slot) document_slot,review_status
    FROM public.user_files
    WHERE owner_user_id=p_user_id
      AND document_slot IN ('aadhaar_front','aadhaar_back','profile_photo')
    ORDER BY document_slot,created_at DESC,id DESC
  ) latest WHERE latest.review_status='approved';
  IF latest_approved<>3 THEN
    RAISE EXCEPTION 'Three latest identity documents must be approved before requesting a service'
      USING ERRCODE='P0001';
  END IF;

  SELECT * INTO pending FROM public.applications WHERE user_id=p_user_id
    AND type='technician' AND status IN ('pending','pending_approval')
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF pending.payload->>'role'=requested_role THEN
      RETURN jsonb_build_object('application_id',pending.id,'status',pending.status,'already_submitted',true);
    END IF;
    RAISE EXCEPTION 'Another service application is pending review' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.applications(user_id,type,status,payload)
  VALUES (
    p_user_id,'technician','pending',
    jsonb_build_object(
      'type','technician','role',requested_role,'skills',jsonb_build_array(expected_skill),
      'full_name',trim(account.full_name),'phone',coalesce(account.phone,''),
      'city',trim(account.city),'working_area',trim(p_working_area),
      'working_pincode',p_working_pincode,'requested_radius_km',radius_km,
      'experience_years',p_experience_years,'work_description',trim(p_work_description),
      'application_source','existing_technician_service_approval'
    )
  ) RETURNING * INTO created;

  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,meta)
  VALUES(p_user_id,'technician.service_application_requested','applications',created.id::text,
    jsonb_build_object('requested_service',p_service_key,'requested_city',account.city));
  RETURN jsonb_build_object('application_id',created.id,'status','pending','already_submitted',false);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_technician_service_request(uuid,text,text,text,integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_technician_service_request(uuid,text,text,text,integer,text)
  TO service_role;

-- Preserve the existing atomic, auditable role/skill review, but align it
-- with the latest-documents policy. A user-declared skill never auto-approves.
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
  -- Only the most recent file per slot counts. An approved old version
  -- must not bypass an admin rejection of a newer replacement.
  SELECT count(*) INTO approved_docs FROM (
    SELECT DISTINCT ON (document_slot) document_slot,review_status
    FROM public.user_files
    WHERE owner_user_id=a.user_id
      AND document_slot IN ('aadhaar_front','aadhaar_back','profile_photo')
    ORDER BY document_slot,created_at DESC,id DESC
  ) latest WHERE latest.review_status='approved';
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
