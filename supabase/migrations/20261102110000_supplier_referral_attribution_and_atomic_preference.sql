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
CREATE INDEX IF NOT EXISTS supplier_referral_attributions_supplier_idx ON public.supplier_referral_attributions(supplier_id, priority_expires_at);
ALTER TABLE public.supplier_referral_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_referral_attributions FROM anon, authenticated;
-- Transactional customer choice; prevents multiple simultaneously active choices.
CREATE OR REPLACE FUNCTION public.set_customer_supplier_preference(p_customer uuid,p_supplier uuid,p_remove boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now timestamptz := now();
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_customer::text, 17));
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
