-- AuroTap subscription loyalty redemption and balance integrity.
-- Additive and reversible at the ledger level; never delete earned points/history.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_redemption_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_loyalty_reservation_key_unique
  ON public.subscription_loyalty_events(customer_id, (metadata->>'reservation_key'))
  WHERE event_type = 'redemption' AND metadata ? 'reservation_key';

CREATE UNIQUE INDEX IF NOT EXISTS subscription_loyalty_reversal_source_unique
  ON public.subscription_loyalty_events(customer_id, (metadata->>'source_event_id'))
  WHERE event_type = 'reversal' AND metadata ? 'source_event_id';

INSERT INTO public.settings(key, value) VALUES
  ('subscription_loyalty_free_can_enabled', 'true'),
  ('subscription_loyalty_service_discount_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.subscription_loyalty_balance(p_customer_id UUID)
RETURNS BIGINT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points_delta), 0)::BIGINT
  FROM public.subscription_loyalty_events
  WHERE customer_id = p_customer_id;
$$;

REVOKE ALL ON FUNCTION public.subscription_loyalty_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_loyalty_balance(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_subscription_loyalty_redemption(
  p_customer_id UUID,
  p_points INTEGER,
  p_discount NUMERIC,
  p_redemption_type TEXT,
  p_service_key TEXT,
  p_base_amount NUMERIC,
  p_reservation_key UUID
)
RETURNS TABLE(event_id UUID, points_balance BIGINT, discount_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
  v_enabled BOOLEAN := true;
  v_free_enabled BOOLEAN := true;
  v_service_enabled BOOLEAN := true;
  v_target INTEGER := 300;
  v_points_per_rupee INTEGER := 1;
  v_max_discount INTEGER := 20;
  v_service_flag BOOLEAN := false;
  v_expected_points INTEGER;
  v_event_id UUID;
BEGIN
  IF p_customer_id IS NULL OR p_points <= 0 OR p_discount <= 0 OR p_base_amount <= 0 OR p_reservation_key IS NULL THEN
    RAISE EXCEPTION 'Invalid loyalty redemption request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id::TEXT, 0));

  SELECT lower(value) <> 'false' INTO v_enabled FROM public.settings WHERE key = 'subscription_loyalty_enabled';
  SELECT lower(value) <> 'false' INTO v_free_enabled FROM public.settings WHERE key = 'subscription_loyalty_free_can_enabled';
  SELECT lower(value) <> 'false' INTO v_service_enabled FROM public.settings WHERE key = 'subscription_loyalty_service_discount_enabled';
  SELECT value::INTEGER INTO v_target FROM public.settings WHERE key = 'subscription_loyalty_points_per_reward';
  SELECT value::INTEGER INTO v_points_per_rupee FROM public.settings WHERE key = 'subscription_loyalty_points_per_rupee';
  SELECT value::INTEGER INTO v_max_discount FROM public.settings WHERE key = 'subscription_loyalty_max_discount_percent';
  v_enabled := COALESCE(v_enabled, true);
  v_free_enabled := COALESCE(v_free_enabled, true);
  v_service_enabled := COALESCE(v_service_enabled, true);
  v_target := GREATEST(100, LEAST(10000, COALESCE(v_target, 300)));
  v_points_per_rupee := GREATEST(1, LEAST(100, COALESCE(v_points_per_rupee, 1)));
  v_max_discount := GREATEST(1, LEAST(50, COALESCE(v_max_discount, 20)));

  IF NOT v_enabled THEN RAISE EXCEPTION 'Loyalty rewards are currently paused' USING ERRCODE = 'P0001'; END IF;

  IF p_redemption_type = 'free_can' THEN
    IF NOT v_free_enabled OR p_service_key <> 'water_can' OR p_points < v_target OR p_points <> v_target OR p_discount > p_base_amount OR p_discount > 25 THEN
      RAISE EXCEPTION 'Free-can reward is not eligible for this order' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_redemption_type = 'service_discount' THEN
    IF NOT v_service_enabled OR p_service_key NOT IN ('plumbing', 'tank_cleaning') THEN
      RAISE EXCEPTION 'Service discount is not enabled for this service' USING ERRCODE = 'P0001';
    END IF;
    IF p_service_key = 'plumbing' THEN
      SELECT lower(value) <> 'false' INTO v_service_flag FROM public.settings WHERE key = 'subscription_loyalty_plumbing_enabled';
    ELSE
      SELECT lower(value) <> 'false' INTO v_service_flag FROM public.settings WHERE key = 'subscription_loyalty_tank_cleaning_enabled';
    END IF;
    IF NOT COALESCE(v_service_flag, true) OR p_discount > round(p_base_amount * v_max_discount / 100.0, 2) THEN
      RAISE EXCEPTION 'Service discount exceeds the configured offer' USING ERRCODE = 'P0001';
    END IF;
    v_expected_points := CEIL(p_discount * v_points_per_rupee)::INTEGER;
    IF p_points <> v_expected_points THEN
      RAISE EXCEPTION 'Points do not match the configured discount' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown loyalty reward type' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(points_delta), 0)::BIGINT INTO v_balance
  FROM public.subscription_loyalty_events WHERE customer_id = p_customer_id;

  IF v_balance < p_points THEN
    RAISE EXCEPTION 'Not enough loyalty points' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.subscription_loyalty_events
    (customer_id, event_type, points_delta, description, metadata)
  VALUES
    (p_customer_id, 'redemption', -p_points, CASE WHEN p_redemption_type = 'free_can' THEN 'Reserved free-can reward' ELSE 'Reserved service discount' END,
     jsonb_build_object('reservation_key', p_reservation_key, 'redemption_type', p_redemption_type,
                        'service_key', p_service_key, 'discount_amount', p_discount, 'status', 'reserved'))
  RETURNING id INTO v_event_id;

  RETURN QUERY SELECT v_event_id, v_balance - p_points, p_discount;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_subscription_loyalty_redemption(UUID, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_subscription_loyalty_redemption(UUID, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_subscription_loyalty_redemption(
  p_customer_id UUID, p_event_id UUID, p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscription_loyalty_events
  SET order_id = p_order_id,
      description = CASE WHEN metadata->>'redemption_type' = 'free_can' THEN 'Redeemed free standard RO can' ELSE 'Redeemed service discount' END,
      metadata = metadata || jsonb_build_object('status', 'redeemed', 'redeemed_at', now())
  WHERE id = p_event_id AND customer_id = p_customer_id AND event_type = 'redemption'
    AND metadata->>'status' = 'reserved' AND order_id IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_subscription_loyalty_redemption(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_subscription_loyalty_redemption(UUID, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.reverse_subscription_loyalty_redemption(
  p_customer_id UUID, p_event_id UUID, p_reason TEXT DEFAULT 'Order creation failed'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.subscription_loyalty_events%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id::TEXT, 0));
  SELECT * INTO v_event FROM public.subscription_loyalty_events
  WHERE id = p_event_id AND customer_id = p_customer_id AND event_type = 'redemption'
    AND metadata->>'status' = 'reserved' AND order_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.subscription_loyalty_events
    (customer_id, subscription_id, event_type, points_delta, description, metadata)
  VALUES
    (p_customer_id, v_event.subscription_id, 'reversal', ABS(v_event.points_delta),
     'Loyalty points returned: ' || COALESCE(p_reason, 'Order creation failed'),
     jsonb_build_object('source_event_id', v_event.id, 'reservation_key', v_event.metadata->>'reservation_key'));

  UPDATE public.subscription_loyalty_events
  SET metadata = metadata || jsonb_build_object('status', 'reversed', 'reversed_at', now())
  WHERE id = v_event.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_subscription_loyalty_redemption(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_subscription_loyalty_redemption(UUID, UUID, TEXT) TO service_role;

COMMIT;
