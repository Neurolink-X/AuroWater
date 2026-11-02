-- Additive supplier shop approval migration. No live rows modified during installation.
BEGIN;
CREATE TABLE IF NOT EXISTS public.supplier_shop_location_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.supplier_profile_change_requests(id),
 supplier_id uuid NOT NULL REFERENCES public.profiles(id),
 reviewed_by uuid NOT NULL REFERENCES public.profiles(id),
 previous_snapshot jsonb NOT NULL, applied_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_shop_location_history_supplier_created_idx
 ON public.supplier_shop_location_history(supplier_id,created_at DESC);
ALTER TABLE public.supplier_shop_location_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_shop_location_history FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.supplier_shop_location_history TO service_role;

-- Prevent suppliers from bypassing shop approval by updating their own settings via the Data API.
-- Online status, service radius and payout fields continue to work normally.
CREATE OR REPLACE FUNCTION public.guard_supplier_shop_base()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND (
  (TG_OP='INSERT' AND (
   NEW.base_lat IS NOT NULL OR NEW.base_lng IS NOT NULL OR
   NEW.business_address IS NOT NULL OR NEW.business_name IS NOT NULL OR NEW.pincode IS NOT NULL
  )) OR (TG_OP='UPDATE' AND (
   NEW.base_lat IS DISTINCT FROM OLD.base_lat OR
   NEW.base_lng IS DISTINCT FROM OLD.base_lng OR
   NEW.business_address IS DISTINCT FROM OLD.business_address OR
   NEW.business_name IS DISTINCT FROM OLD.business_name OR
   NEW.pincode IS DISTINCT FROM OLD.pincode
  ))
 ) THEN
  RAISE EXCEPTION 'Shop location requires admin approval' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_supplier_shop_base_write ON public.supplier_settings;
CREATE TRIGGER guard_supplier_shop_base_write BEFORE INSERT OR UPDATE ON public.supplier_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_shop_base();

CREATE OR REPLACE FUNCTION public.review_supplier_shop_change(
 p_request_id uuid,p_admin_id uuid,p_decision text,p_note text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
 r public.supplier_profile_change_requests%ROWTYPE;
 p public.profiles%ROWTYPE;
 s public.supplier_settings%ROWTYPE;
 c jsonb;
 v_city text; v_pin text; v_lat numeric; v_lng numeric;
 v_city_lat numeric; v_city_lng numeric; v_distance numeric;
 old_snapshot jsonb; new_snapshot jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_admin_id AND role='admin') THEN
  RAISE EXCEPTION 'Admin only' USING ERRCODE='42501';
 END IF;
 IF p_decision NOT IN ('APPROVED','REJECTED') THEN
  RAISE EXCEPTION 'Unknown decision' USING ERRCODE='P0001';
 END IF;
 SELECT * INTO r FROM public.supplier_profile_change_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.status <> 'PENDING' THEN
  RAISE EXCEPTION 'Request is no longer pending' USING ERRCODE='P0001';
 END IF;
 IF p_decision='APPROVED' THEN
  c:=r.requested_changes;
  v_city:=NULLIF(btrim(c->>'city'),'');
  v_pin:=NULLIF(btrim(c->>'pincode'),'');
  IF v_city IS NULL OR v_pin IS NULL OR v_pin !~ '^[0-9]{6}$' OR
     length(btrim(COALESCE(c->>'address',''))) < 8 OR
     length(btrim(COALESCE(c->>'full_name',''))) < 2 OR
     jsonb_typeof(c->'base_lat') IS DISTINCT FROM 'number' OR
     jsonb_typeof(c->'base_lng') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Shop details and map pin required' USING ERRCODE='P0001';
  END IF;
  v_lat := (c->>'base_lat')::numeric; v_lng := (c->>'base_lng')::numeric;
  IF v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180 OR
     (v_lat=0 AND v_lng=0) THEN
    RAISE EXCEPTION 'Invalid shop coordinates' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pincode_directory WHERE pincode=v_pin) THEN
   RAISE EXCEPTION 'Unknown postal PIN' USING ERRCODE='P0001';
  END IF;
  SELECT lat,lng INTO v_city_lat,v_city_lng FROM public.cities
    WHERE lower(name)=lower(v_city) LIMIT 1;
  IF v_city_lat IS NULL OR v_city_lng IS NULL THEN
   RAISE EXCEPTION 'Configured city coordinates unavailable' USING ERRCODE='P0001';
  END IF;
  v_distance := 6371*2*asin(least(1,sqrt(
   power(sin(radians((v_city_lat-v_lat)/2)),2) +
   cos(radians(v_lat))*cos(radians(v_city_lat))*
   power(sin(radians((v_city_lng-v_lng)/2)),2))));
  IF v_distance > 100 THEN
   RAISE EXCEPTION 'Shop pin is over 100 km from registered city' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id=r.supplier_id FOR UPDATE;
  IF NOT FOUND OR p.role <> 'supplier' THEN
   RAISE EXCEPTION 'Supplier profile missing' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO s FROM public.supplier_settings WHERE user_id=r.supplier_id FOR UPDATE;
  old_snapshot:=jsonb_build_object('full_name',p.full_name,'phone',p.phone,'city',p.city,
   'business_name',s.business_name,'business_address',s.business_address,
   'pincode',s.pincode,'base_lat',s.base_lat,'base_lng',s.base_lng);
  UPDATE public.profiles SET full_name=btrim(c->>'full_name'),
    phone=COALESCE(NULLIF(btrim(c->>'phone'),''),phone),
    city=v_city,updated_at=now() WHERE id=r.supplier_id;
  INSERT INTO public.supplier_settings(user_id,business_name,business_address,pincode,base_lat,base_lng)
   VALUES(r.supplier_id,NULLIF(btrim(c->>'business_name'),''),
          btrim(c->>'address'),v_pin,v_lat,v_lng)
   ON CONFLICT(user_id) DO UPDATE SET
    business_name=EXCLUDED.business_name,business_address=EXCLUDED.business_address,
    pincode=EXCLUDED.pincode,base_lat=EXCLUDED.base_lat,base_lng=EXCLUDED.base_lng,
    updated_at=now();
  new_snapshot:=jsonb_build_object('full_name',c->>'full_name','phone',c->>'phone',
   'city',v_city,'business_name',c->>'business_name','business_address',c->>'address',
   'pincode',v_pin,'base_lat',v_lat,'base_lng',v_lng);
  INSERT INTO public.supplier_shop_location_history
   (request_id,supplier_id,reviewed_by,previous_snapshot,applied_snapshot)
   VALUES(p_request_id,r.supplier_id,p_admin_id,old_snapshot,new_snapshot);
 ELSE
  IF length(btrim(COALESCE(p_note,''))) < 3 THEN
   RAISE EXCEPTION 'Rejection note required' USING ERRCODE='P0001';
  END IF;
 END IF;
 UPDATE public.supplier_profile_change_requests SET status=p_decision,
  admin_note=NULLIF(btrim(p_note),''),reviewed_by=p_admin_id,
  reviewed_at=now(),updated_at=now()
  WHERE id=p_request_id AND status='PENDING';
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,meta)
 VALUES(p_admin_id,CASE WHEN p_decision='APPROVED' THEN 'supplier_shop_approved'
  ELSE 'supplier_shop_rejected' END,'supplier_profile_change_request',
  p_request_id::text,jsonb_build_object('supplier_id',r.supplier_id,'decision',p_decision));
 RETURN jsonb_build_object('request_id',p_request_id,'supplier_id',r.supplier_id,'status',p_decision);
END;
$$;
REVOKE ALL ON FUNCTION public.review_supplier_shop_change(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_supplier_shop_change(uuid,uuid,text,text) TO service_role;
COMMIT;
