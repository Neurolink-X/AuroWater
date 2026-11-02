-- Referral acquisition is independent of a customer's revocable delivery preference.
-- Only the first verified customer confirmation is attributed; never reset the 90-day clock.
CREATE TABLE IF NOT EXISTS public.supplier_referral_attributions (
 customer_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 supplier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 priority_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
 source text NOT NULL DEFAULT 'supplier_link' CHECK (source = 'supplier_link'),
 CONSTRAINT referral_not_self CHECK (customer_id <> supplier_id)
);
-- Avoid full-table scans during first-order eligibility checks.
CREATE INDEX IF NOT EXISTS orders_customer_referral_eligibility_idx ON public.orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS supplier_customer_relationships_customer_choice_idx
 ON public.supplier_customer_relationships(customer_id,priority_expires_at DESC)
 WHERE status='active' AND referral_source='customer_choice';
CREATE INDEX IF NOT EXISTS supplier_referral_attributions_supplier_idx ON public.supplier_referral_attributions(supplier_id, priority_expires_at);
ALTER TABLE public.supplier_referral_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_referral_attributions FROM anon, authenticated;
-- Transactional customer choice; prevents multiple simultaneously active choices.
CREATE OR REPLACE FUNCTION public.set_customer_supplier_preference(p_customer uuid,p_supplier uuid,p_remove boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_now timestamptz := now();
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_customer::text, 17));
 IF p_customer IS NULL OR p_supplier IS NULL THEN RAISE EXCEPTION 'Customer and supplier required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_customer AND role='customer') THEN
   RAISE EXCEPTION 'Customer unavailable';
 END IF;
 IF p_remove THEN
   UPDATE public.supplier_customer_relationships SET status='revoked',updated_at=v_now
   WHERE customer_id=p_customer AND supplier_id=p_supplier AND status='active';
   RETURN;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_supplier AND role='supplier' AND COALESCE(is_active,true)=true AND status='active') THEN
   RAISE EXCEPTION 'Supplier unavailable';
 END IF;
 UPDATE public.supplier_customer_relationships SET status='revoked',updated_at=v_now
 WHERE customer_id=p_customer AND supplier_id<>p_supplier AND status='active';
 INSERT INTO public.supplier_customer_relationships
 (customer_id,supplier_id,referral_source,status,customer_confirmed_at,priority_expires_at,updated_at)
 VALUES (p_customer,p_supplier,'customer_choice','active',v_now,v_now+interval '90 days',v_now)
 ON CONFLICT (customer_id,supplier_id) DO UPDATE SET
 status='active',referral_source='customer_choice',updated_at=v_now,
 customer_confirmed_at=COALESCE(supplier_customer_relationships.customer_confirmed_at,EXCLUDED.customer_confirmed_at),
 priority_expires_at=CASE WHEN supplier_customer_relationships.status='active' AND supplier_customer_relationships.priority_expires_at>v_now
 THEN supplier_customer_relationships.priority_expires_at ELSE EXCLUDED.priority_expires_at END;
END $$;
REVOKE ALL ON FUNCTION public.set_customer_supplier_preference(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_customer_supplier_preference(uuid,uuid,boolean) TO service_role;

-- One-time attribution is transactionally serialized against other confirmations.
-- Enforce this in the database rather than trusting an API's read-then-write sequence.
CREATE OR REPLACE FUNCTION public.confirm_customer_supplier_referral(p_customer uuid,p_supplier uuid)
RETURNS TABLE(supplier_id uuid, priority_expires_at timestamptz, already_confirmed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_existing public.supplier_referral_attributions%ROWTYPE;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_customer::text, 17));
 IF p_customer IS NULL OR p_supplier IS NULL THEN RAISE EXCEPTION 'Customer and supplier required'; END IF;
 IF p_customer = p_supplier THEN RAISE EXCEPTION 'Self-referral not allowed'; END IF;

 SELECT * INTO v_existing FROM public.supplier_referral_attributions a WHERE a.customer_id=p_customer;
 IF FOUND THEN
   RETURN QUERY SELECT v_existing.supplier_id,v_existing.priority_expires_at,true;
   RETURN;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_customer AND role='customer') THEN
   RAISE EXCEPTION 'Customer unavailable';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_supplier AND role='supplier' AND COALESCE(is_active,true)=true AND status='active') THEN
   RAISE EXCEPTION 'Supplier unavailable';
 END IF;
 IF EXISTS (SELECT 1 FROM public.orders WHERE customer_id=p_customer LIMIT 1) THEN
   RAISE EXCEPTION 'Existing customer is not eligible';
 END IF;
 INSERT INTO public.supplier_referral_attributions(customer_id,supplier_id)
 VALUES(p_customer,p_supplier) RETURNING supplier_referral_attributions.supplier_id,supplier_referral_attributions.priority_expires_at
 INTO v_existing.supplier_id,v_existing.priority_expires_at;
 RETURN QUERY SELECT v_existing.supplier_id,v_existing.priority_expires_at,false;
END $$;
REVOKE ALL ON FUNCTION public.confirm_customer_supplier_referral(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_customer_supplier_referral(uuid,uuid) TO service_role;

-- Prevent referral claims racing with the first order insert by serializing on the customer.
CREATE OR REPLACE FUNCTION public.lock_customer_referral_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.customer_id IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.customer_id::text,17));
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lock_customer_referral_eligibility_before_order ON public.orders;
CREATE TRIGGER lock_customer_referral_eligibility_before_order
BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.lock_customer_referral_eligibility();
