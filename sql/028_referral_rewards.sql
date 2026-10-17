-- AuroTap referral rewards v1.
-- Additive only: keeps profiles.referral_code/referred_by and referral_credits intact.
BEGIN;

CREATE TABLE IF NOT EXISTS public.referral_reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  qualifying_order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount_25', 'free_water_can')),
  reward_status TEXT NOT NULL DEFAULT 'available'
    CHECK (reward_status IN ('available', 'reserved', 'redeemed', 'void')),
  reserved_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_reward_event_once_per_customer UNIQUE (referred_customer_id, reward_type, qualifying_order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_reward_once_per_order_type
  ON public.referral_reward_events (qualifying_order_id, reward_type);

CREATE INDEX IF NOT EXISTS referral_rewards_available_idx
  ON public.referral_reward_events (referrer_id, reward_status, created_at);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referral_reward_id UUID REFERENCES public.referral_reward_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (referral_discount_amount >= 0);

COMMENT ON COLUMN public.orders.referral_reward_id IS
  'Referral reward consumed by this order; set only by the authenticated server workflow.';
COMMENT ON COLUMN public.orders.referral_discount_amount IS
  'Server-calculated referral discount snapshot in INR.';

ALTER TABLE public.referral_reward_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referral_reward_events_select_own ON public.referral_reward_events;
CREATE POLICY referral_reward_events_select_own ON public.referral_reward_events
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_customer_id = auth.uid());

-- Applying a code is allowed only before the customer has placed any order.
-- This prevents changing referral ownership after a reward becomes foreseeable.
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  referrer UUID;
  current_referrer UUID;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF upper(trim(coalesce(p_code, ''))) !~ '^AT-[A-F0-9]{6}$' THEN
    RAISE EXCEPTION 'Enter a valid AuroTap referral code' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO referrer
  FROM public.profiles
  WHERE referral_code = upper(trim(p_code))
    AND id <> actor
    AND role = 'customer'
    AND is_active = true
    AND deleted_at IS NULL;

  IF referrer IS NULL THEN
    RAISE EXCEPTION 'Referral code is invalid or unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT referred_by INTO current_referrer
  FROM public.profiles
  WHERE id = actor AND role = 'customer' AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active customer account required' USING ERRCODE = '42501';
  END IF;
  IF current_referrer IS NOT NULL THEN
    IF current_referrer = referrer THEN RETURN referrer; END IF;
    RAISE EXCEPTION 'A referral code has already been applied to this account' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE customer_id = actor) THEN
    RAISE EXCEPTION 'Referral codes must be applied before your first booking' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles SET referred_by = referrer, updated_at = now() WHERE id = actor;
  RETURN referrer;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_referral_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT) TO authenticated;

-- A successful referral is earned only after a referred customer's first
-- completed AND paid booking. A distinct saved address is required per referral.
-- Each valid referral gives the referrer a 25% reward; every fifth distinct
-- qualified referral also grants one standard (not chilled/subscription) water can.
CREATE OR REPLACE FUNCTION public.award_referral_reward_after_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer UUID;
  first_qualifying_order UUID;
  qualifying_address UUID;
  qualified_count INTEGER;
  reward_kind TEXT;
BEGIN
  IF NEW.status <> 'COMPLETED'
     OR lower(coalesce(NEW.payment_status, '')) <> 'paid'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'COMPLETED' AND lower(coalesce(OLD.payment_status, '')) = 'paid') THEN
    RETURN NEW;
  END IF;

  SELECT p.referred_by INTO referrer
  FROM public.profiles p
  WHERE p.id = NEW.customer_id
    AND p.referred_by IS NOT NULL
    AND p.role = 'customer'
    AND p.is_active = true;

  IF referrer IS NULL THEN RETURN NEW; END IF;

  -- Only the first qualifying order of a referred customer counts.
  SELECT o.id, o.address_id INTO first_qualifying_order, qualifying_address
  FROM public.orders o
  WHERE o.customer_id = NEW.customer_id
    AND o.status = 'COMPLETED'
    AND lower(coalesce(o.payment_status, '')) = 'paid'
  ORDER BY o.created_at ASC, o.id ASC
  LIMIT 1;

  IF first_qualifying_order IS DISTINCT FROM NEW.id THEN RETURN NEW; END IF;
  IF qualifying_address IS NULL THEN RETURN NEW; END IF;

  -- One distinct saved address per referral; prevents counting several accounts
  -- repeatedly at the same address. The referred account itself is unique too.
  PERFORM pg_advisory_xact_lock(hashtext(referrer::text));

  IF EXISTS (
    SELECT 1 FROM public.referral_reward_events e
    WHERE e.referrer_id = referrer
      AND e.referred_customer_id = NEW.customer_id
      AND e.reward_type = 'discount_25'
  ) THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.referral_reward_events e
    JOIN public.addresses old_addr ON old_addr.id = e.address_id
    JOIN public.addresses new_addr ON new_addr.id = qualifying_address
    WHERE e.referrer_id = referrer
      AND e.reward_type = 'discount_25'
      AND lower(trim(old_addr.house_flat)) = lower(trim(new_addr.house_flat))
      AND lower(trim(old_addr.area)) = lower(trim(new_addr.area))
      AND lower(trim(old_addr.city)) = lower(trim(new_addr.city))
      AND regexp_replace(coalesce(old_addr.pincode, ''), '[^0-9]', '', 'g') =
          regexp_replace(coalesce(new_addr.pincode, ''), '[^0-9]', '', 'g')
  ) THEN RETURN NEW; END IF;

  SELECT COUNT(DISTINCT e.referred_customer_id)::INTEGER INTO qualified_count
  FROM public.referral_reward_events e
  WHERE e.referrer_id = referrer AND e.reward_type = 'discount_25';

  INSERT INTO public.referral_reward_events (
    referrer_id, referred_customer_id, qualifying_order_id, address_id, reward_type
  ) VALUES (
    referrer, NEW.customer_id, NEW.id, qualifying_address, 'discount_25'
  ) ON CONFLICT (qualifying_order_id, reward_type) DO NOTHING;

  -- Count only distinct-address, successfully paid referral events.
  SELECT COUNT(DISTINCT e.referred_customer_id)::INTEGER INTO qualified_count
  FROM public.referral_reward_events e
  WHERE e.referrer_id = referrer AND e.reward_type = 'discount_25';

  IF qualified_count > 0 AND qualified_count % 5 = 0 THEN
    reward_kind := 'free_water_can';
    IF NOT EXISTS (
      SELECT 1 FROM public.referral_reward_events e
      WHERE e.referrer_id = referrer
        AND e.reward_type = reward_kind
        AND e.qualifying_order_id = NEW.id
    ) THEN
      INSERT INTO public.referral_reward_events (
        referrer_id, referred_customer_id, qualifying_order_id, address_id, reward_type
      ) VALUES (
        referrer, NEW.customer_id, NEW.id, qualifying_address, reward_kind
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_award_referral_reward ON public.orders;
CREATE TRIGGER orders_award_referral_reward
  AFTER INSERT OR UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.award_referral_reward_after_order();

-- Never let customers create or alter reward ledger entries directly.
REVOKE INSERT, UPDATE, DELETE ON public.referral_reward_events FROM anon, authenticated;
GRANT SELECT ON public.referral_reward_events TO authenticated;


-- Reward lifecycle follows the linked order: cancellation releases the reward;
-- completion consumes it. A pending booking cannot be used to reuse rewards.
CREATE OR REPLACE FUNCTION public.sync_referral_reward_order_state()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referral_reward_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'CANCELLED' THEN
    UPDATE public.referral_reward_events
    SET reward_status = 'available', reserved_order_id = NULL
    WHERE id = NEW.referral_reward_id AND reward_status = 'reserved'
      AND (reserved_order_id = NEW.id OR reserved_order_id IS NULL);
  ELSIF NEW.status = 'COMPLETED' AND lower(coalesce(NEW.payment_status, '')) = 'paid' THEN
    UPDATE public.referral_reward_events
    SET reward_status = 'redeemed', reserved_order_id = NEW.id, redeemed_at = COALESCE(redeemed_at, now())
    WHERE id = NEW.referral_reward_id AND reward_status = 'reserved'
      AND (reserved_order_id = NEW.id OR reserved_order_id IS NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_sync_referral_reward ON public.orders;
CREATE TRIGGER orders_sync_referral_reward
  AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_referral_reward_order_state();

-- Preserve the approved ₹20 supplier entitlement when AuroTap funds a discount.
CREATE OR REPLACE FUNCTION public.complete_supplier_order_atomic(
  p_order_id UUID,
  p_supplier_id UUID,
  p_payment_confirmed BOOLEAN,
  p_payment_reference TEXT,
  p_payment_collector TEXT
)
RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $
DECLARE
  v_role TEXT;
  v_order public.orders%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_was_paid BOOLEAN;
  v_method TEXT;
  v_supplier_entitlement NUMERIC(10,2);
BEGIN
  IF auth.uid() IS DISTINCT FROM p_supplier_id THEN
    RAISE EXCEPTION 'supplier_identity_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_role IS DISTINCT FROM 'supplier' THEN RAISE EXCEPTION 'supplier_role_required' USING ERRCODE = '42501'; END IF;

  SELECT o.* INTO v_order FROM public.orders o
  WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found_or_forbidden' USING ERRCODE = '42501'; END IF;
  IF upper(COALESCE(v_order.status, '')) <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'invalid_order_transition' USING ERRCODE = '40001';
  END IF;

  v_was_paid := lower(COALESCE(v_order.payment_status, 'unpaid')) = 'paid';
  v_method := lower(COALESCE(v_order.payment_method, 'cash'));
  IF NOT v_was_paid AND p_payment_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'payment_confirmation_required' USING ERRCODE = '22023';
  END IF;
  IF NOT v_was_paid AND v_method = 'upi' AND NULLIF(btrim(COALESCE(p_payment_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'upi_reference_required' USING ERRCODE = '22023';
  END IF;
  IF NOT v_was_paid AND (p_payment_collector IS NULL OR p_payment_collector NOT IN ('supplier', 'aurotap')) THEN
    RAISE EXCEPTION 'payment_collector_required' USING ERRCODE = '22023';
  END IF;

  v_supplier_entitlement := NULL;
  IF lower(COALESCE(v_order.service_type, '')) = 'water_can'
     AND COALESCE(v_order.can_count, 0) = 1
     AND round(COALESCE(v_order.total_amount, 0) + COALESCE(v_order.referral_discount_amount, 0), 2) = 20 THEN
    v_supplier_entitlement := 20;
  END IF;

  UPDATE public.orders
  SET status = 'COMPLETED',
      completed_at = v_now,
      payment_status = CASE WHEN v_was_paid THEN payment_status ELSE 'paid' END,
      payment_confirmed_at = CASE WHEN v_was_paid THEN payment_confirmed_at ELSE v_now END,
      payment_reference = CASE WHEN v_was_paid THEN payment_reference ELSE NULLIF(btrim(COALESCE(p_payment_reference, '')), '') END,
      payment_collector = CASE WHEN v_was_paid THEN payment_collector ELSE p_payment_collector END,
      payment_collected_by = CASE WHEN v_was_paid THEN payment_collected_by WHEN p_payment_collector = 'supplier' THEN p_supplier_id ELSE NULL END,
      payment_collected_amount = CASE WHEN v_was_paid THEN payment_collected_amount ELSE total_amount END,
      payment_collected_at = CASE WHEN v_was_paid THEN payment_collected_at ELSE v_now END,
      supplier_payout = CASE WHEN v_supplier_entitlement IS NOT NULL AND financials_posted_at IS NULL
          AND COALESCE(supplier_payout, 0) <> v_supplier_entitlement THEN v_supplier_entitlement ELSE supplier_payout END,
      payout_status = CASE WHEN v_supplier_entitlement IS NOT NULL AND financials_posted_at IS NULL
          AND COALESCE(supplier_payout, 0) <> v_supplier_entitlement THEN 'pending' ELSE payout_status END
  WHERE id = p_order_id AND supplier_id = p_supplier_id RETURNING * INTO v_order;

  IF v_supplier_entitlement IS NOT NULL AND v_order.financials_posted_at IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.wallet_ledger wl WHERE wl.order_id = p_order_id AND wl.entry_type = 'ORDER_EARNING') THEN
      RAISE EXCEPTION 'order_earning_ledger_already_exists' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.wallet_ledger (
      payee_id, payee_role, order_id, entry_type, amount, note, metadata, created_by
    ) VALUES (
      p_supplier_id, 'supplier', p_order_id, 'ORDER_EARNING', v_supplier_entitlement,
      'Supplier entitlement for verified single-can water order; referral discount funded by AuroTap',
      jsonb_build_object('service_type','water_can','can_count',1,
        'customer_total',v_order.total_amount,
        'referral_discount_amount',COALESCE(v_order.referral_discount_amount,0),
        'gross_can_value',COALESCE(v_order.total_amount,0)+COALESCE(v_order.referral_discount_amount,0)),
      p_supplier_id
    );
    UPDATE public.orders SET financials_posted_at = v_now, financials_payee_id = p_supplier_id
    WHERE id = p_order_id AND supplier_id = p_supplier_id RETURNING * INTO v_order;
  END IF;
  RETURN NEXT v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_supplier_order_atomic(UUID, UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_supplier_order_atomic(UUID, UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

COMMIT;
