-- Optional, off-by-default parallel water-can offer waves and per-supplier workload capacity.
-- No customer or supplier record is changed by this migration.
BEGIN;
ALTER TABLE public.supplier_settings ADD COLUMN IF NOT EXISTS max_active_orders integer NOT NULL DEFAULT 15;
ALTER TABLE public.supplier_settings DROP CONSTRAINT IF EXISTS supplier_active_order_limit_valid;
ALTER TABLE public.supplier_settings ADD CONSTRAINT supplier_active_order_limit_valid CHECK(max_active_orders BETWEEN 5 AND 20);
INSERT INTO public.settings(key,value) VALUES
('parallel_supplier_offers_enabled','false'),
('parallel_supplier_offer_seconds','60'),
('parallel_supplier_offer_fanout','3')
ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.order_supplier_offers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 supplier_id uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','EXPIRED','CLAIMED','LOST','DECLINED')),
 distance_km numeric(9,2) NOT NULL CHECK(distance_km>=0 AND distance_km<=100),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 responded_at timestamptz,
 batch_no integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS parallel_offer_one_open_per_supplier
 ON public.order_supplier_offers(order_id,supplier_id) WHERE status='OPEN';
CREATE INDEX IF NOT EXISTS parallel_offer_supplier_poll
 ON public.order_supplier_offers(supplier_id,status,expires_at DESC);
CREATE INDEX IF NOT EXISTS parallel_offer_order_state
 ON public.order_supplier_offers(order_id,status,expires_at);
ALTER TABLE public.order_supplier_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_supplier_offers FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.order_supplier_offers TO service_role;

-- Serialize active-order admissions for each supplier, even if two workers
-- try to assign two different orders at exactly the same time.
CREATE OR REPLACE FUNCTION public.guard_supplier_active_capacity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_limit int; v_used int;
BEGIN
 IF NEW.supplier_id IS NULL OR NEW.status NOT IN ('ASSIGNED','IN_PROGRESS') THEN RETURN NEW; END IF;
 IF OLD.supplier_id IS NOT DISTINCT FROM NEW.supplier_id
    AND OLD.status IN ('ASSIGNED','IN_PROGRESS') THEN RETURN NEW; END IF;
 SELECT max_active_orders INTO v_limit FROM public.supplier_settings
   WHERE user_id=NEW.supplier_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLIER_SETTINGS_MISSING' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO v_used FROM public.orders
   WHERE supplier_id=NEW.supplier_id AND status IN ('ASSIGNED','IN_PROGRESS')
   AND id<>NEW.id;
 IF v_used>=v_limit THEN RAISE EXCEPTION 'SUPPLIER_AT_CAPACITY' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS supplier_order_active_capacity_guard ON public.orders;
CREATE TRIGGER supplier_order_active_capacity_guard
 BEFORE UPDATE OF supplier_id,status ON public.orders
 FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_active_capacity();
REVOKE ALL ON FUNCTION public.guard_supplier_active_capacity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.issue_parallel_water_offers(
 p_order_id uuid,p_suppliers uuid[],p_distances numeric[],p_duration_seconds int DEFAULT 60
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order public.orders; v_count int:=0; v_i int; v_max int:=3;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'SERVER_ONLY' USING ERRCODE='42501'; END IF;
 IF p_suppliers IS NULL OR cardinality(p_suppliers)<1 OR cardinality(p_suppliers)>3 OR
    cardinality(p_distances)<>cardinality(p_suppliers) OR p_duration_seconds NOT BETWEEN 30 AND 120
 THEN RETURN 0; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.service_type<>'water_can' OR v_order.status<>'PENDING' OR v_order.supplier_id IS NOT NULL THEN RETURN 0; END IF;
 UPDATE public.order_supplier_offers SET status='EXPIRED',responded_at=now()
 WHERE order_id=p_order_id AND status='OPEN' AND expires_at<=now();
 IF EXISTS(SELECT 1 FROM public.order_supplier_offers WHERE order_id=p_order_id AND status='OPEN') THEN RETURN 0; END IF;
 FOR v_i IN 1..cardinality(p_suppliers) LOOP
   IF p_distances[v_i] IS NOT NULL AND p_distances[v_i] BETWEEN 0 AND 100 AND
      NOT p_suppliers[v_i]=ANY(p_suppliers[1:v_i-1]) THEN
     INSERT INTO public.order_supplier_offers(order_id,supplier_id,distance_km,expires_at,batch_no)
     VALUES(p_order_id,p_suppliers[v_i],p_distances[v_i],now()+(p_duration_seconds||' seconds')::interval,
       coalesce(v_order.dispatch_attempts,0)+1)
     ON CONFLICT DO NOTHING;
     IF FOUND THEN v_count:=v_count+1; END IF;
   END IF;
 END LOOP;
 IF v_count>0 THEN
  UPDATE public.orders SET last_dispatch_at=now(),dispatch_attempts=coalesce(dispatch_attempts,0)+1 WHERE id=p_order_id;
 END IF;
 RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.issue_parallel_water_offers(uuid,uuid[],numeric[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_parallel_water_offers(uuid,uuid[],numeric[],integer) TO service_role;

-- This is the ONLY accept path for a parallel offer. Order row lock guarantees
-- a single winner; existing stock reservation RPC is reused in the SAME transaction.
CREATE OR REPLACE FUNCTION public.claim_parallel_water_offer(p_offer_id uuid,p_supplier_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_offer public.order_supplier_offers; v_order public.orders;
 v_s public.supplier_settings; v_p public.profiles;
 v_lat numeric; v_lng numeric; v_city text; v_pin text;
 v_latstr text; v_lngstr text; v_dist numeric;
 v_capacity int; v_won boolean;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'SERVER_ONLY' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_offer FROM public.order_supplier_offers WHERE id=p_offer_id AND supplier_id=p_supplier_id;
 IF NOT FOUND OR v_offer.status<>'OPEN' OR v_offer.expires_at<=now() THEN RETURN false; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=v_offer.order_id FOR UPDATE;
 IF NOT FOUND OR v_order.status<>'PENDING' OR v_order.supplier_id IS NOT NULL OR v_order.service_type<>'water_can' THEN RETURN false; END IF;
 SELECT * INTO v_offer FROM public.order_supplier_offers WHERE id=p_offer_id FOR UPDATE;
 IF NOT FOUND OR v_offer.status<>'OPEN' OR v_offer.expires_at<=now() THEN RETURN false; END IF;
 SELECT * INTO v_s FROM public.supplier_settings WHERE user_id=p_supplier_id FOR UPDATE;
 SELECT * INTO v_p FROM public.profiles WHERE id=p_supplier_id;
 IF NOT FOUND OR v_s.user_id IS NULL OR v_s.is_online IS NOT TRUE OR v_p.role<>'supplier' OR
    v_p.is_active IS FALSE OR lower(coalesce(v_p.status,''))<>'active' OR
    (v_p.verification_status IS NOT NULL AND lower(v_p.verification_status)<>'approved')
 THEN RETURN false; END IF;
 IF v_order.address_id IS NOT NULL THEN
   SELECT a.lat,a.lng,a.city,a.pincode INTO v_lat,v_lng,v_city,v_pin
   FROM public.addresses a WHERE a.id=v_order.address_id;
 END IF;
 v_latstr:=v_order.address_snapshot->>'lat';v_lngstr:=v_order.address_snapshot->>'lng';
 IF v_lat IS NULL AND v_latstr~'^-?[0-9]+([.][0-9]+)?$' THEN v_lat:=v_latstr::numeric;END IF;
 IF v_lng IS NULL AND v_lngstr~'^-?[0-9]+([.][0-9]+)?$' THEN v_lng:=v_lngstr::numeric;END IF;
 v_city:=coalesce(nullif(trim(v_city),''),v_order.address_snapshot->>'city');
 v_pin:=coalesce(nullif(trim(v_pin),''),v_order.address_snapshot->>'pincode');
 IF v_lat IS NULL OR v_lng IS NULL OR v_s.base_lat IS NULL OR v_s.base_lng IS NULL
    OR v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180
    OR lower(trim(coalesce(v_city,'')))<>lower(trim(coalesce(v_p.city,''))) THEN RETURN false; END IF;
 -- Current city, zone and exact service permission remain authoritative.
 IF NOT EXISTS(
   SELECT 1 FROM public.service_zones customer_zone
   JOIN public.cities city ON city.id=customer_zone.city_id
   WHERE customer_zone.id=v_order.zone_id AND customer_zone.status IN ('AVAILABLE','LIMITED')
   AND city.status='active'
   AND (customer_zone.services IS NULL OR customer_zone.services @> ARRAY['water_can']::text[])
 ) THEN RETURN false; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.supplier_zones link
  JOIN public.service_zones approved_zone ON approved_zone.id=link.zone_id
  WHERE link.supplier_id=p_supplier_id
    AND (link.service_keys IS NULL OR link.service_keys @> ARRAY['water_can']::text[])
    AND (approved_zone.services IS NULL OR approved_zone.services @> ARRAY['water_can']::text[])
    AND approved_zone.status IN ('AVAILABLE','LIMITED')
    AND lower(trim(approved_zone.city))=lower(trim(coalesce(v_city,'')))
    AND (link.zone_id=v_order.zone_id
      OR (v_pin~'^[0-9]{6}$' AND (v_pin=ANY(approved_zone.pincodes) OR approved_zone.is_catch_all IS TRUE)))
 ) THEN RETURN false; END IF;
 v_dist:=6371*2*asin(least(1,sqrt(
   pow(sin(radians((v_lat-v_s.base_lat)::double precision)/2),2)+
   cos(radians(v_lat::double precision))*cos(radians(v_s.base_lat::double precision))*
   pow(sin(radians((v_lng-v_s.base_lng)::double precision)/2),2)
 )));
 IF v_dist>coalesce(v_s.zone_radius_km,10) THEN RETURN false; END IF;
 SELECT count(*) INTO v_capacity FROM public.orders WHERE supplier_id=p_supplier_id AND status IN ('ASSIGNED','IN_PROGRESS');
 IF v_capacity>=v_s.max_active_orders THEN RETURN false; END IF;
 SELECT public.try_assign_supplier_with_stock(v_order.id,p_supplier_id,round(v_dist,2)) INTO v_won;
 IF v_won IS NOT TRUE THEN RETURN false; END IF;
 UPDATE public.order_supplier_offers SET status='CLAIMED',responded_at=now() WHERE id=p_offer_id;
 UPDATE public.order_supplier_offers SET status='LOST',responded_at=now()
 WHERE order_id=v_order.id AND id<>p_offer_id AND status='OPEN';
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_parallel_water_offer(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_parallel_water_offer(uuid,uuid) TO service_role;

CREATE INDEX IF NOT EXISTS orders_hotspot_recent_zone_idx ON public.orders(zone_id,created_at DESC)
 WHERE service_type='water_can' AND status<>'FAILED';
COMMIT;
