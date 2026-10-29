-- AuroTap subscription loyalty v1.
-- Additive migration: preserves existing recurring-order and referral reward flows.
BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_loyalty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.water_subscriptions(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('renewal', 'streak_bonus', 'redemption', 'admin_adjustment', 'reversal')),
  points_delta INTEGER NOT NULL CHECK (points_delta <> 0),
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_loyalty_once_per_order_event
  ON public.subscription_loyalty_events(order_id, event_type)
  WHERE order_id IS NOT NULL AND event_type IN ('renewal', 'streak_bonus');

CREATE INDEX IF NOT EXISTS subscription_loyalty_customer_history_idx
  ON public.subscription_loyalty_events(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_loyalty_streaks (
  subscription_id UUID PRIMARY KEY REFERENCES public.water_subscriptions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_renewal_month DATE,
  consecutive_months INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_months >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_loyalty_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_loyalty_events_select_own ON public.subscription_loyalty_events;
CREATE POLICY subscription_loyalty_events_select_own
  ON public.subscription_loyalty_events FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin');

REVOKE INSERT, UPDATE, DELETE ON public.subscription_loyalty_events FROM anon, authenticated;
GRANT SELECT ON public.subscription_loyalty_events TO authenticated;

-- Admin-managed settings. The API must validate these bounded keys before writes.
INSERT INTO public.settings(key, value) VALUES
  ('subscription_loyalty_enabled', 'true'),
  ('subscription_loyalty_points_per_renewal', '100'),
  ('subscription_loyalty_points_per_reward', '300'),
  ('subscription_loyalty_streak_months', '3'),
  ('subscription_loyalty_streak_bonus_points', '100'),
  ('subscription_loyalty_points_per_rupee', '1'),
  ('subscription_loyalty_max_discount_percent', '20'),
  ('subscription_loyalty_plumbing_enabled', 'true'),
  ('subscription_loyalty_tank_cleaning_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.award_subscription_loyalty_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subscription_key UUID;
  customer_key UUID;
  renewal_month DATE;
  previous_month DATE;
  previous_streak INTEGER := 0;
  next_streak INTEGER := 1;
  renewal_points INTEGER := 100;
  streak_months INTEGER := 3;
  streak_bonus INTEGER := 100;
  loyalty_enabled BOOLEAN := true;
BEGIN
  IF NEW.status <> 'COMPLETED'
     OR lower(coalesce(NEW.payment_status, '')) <> 'paid'
     OR coalesce(NEW.can_order_type, '') <> 'subscription'
     OR NEW.subscription_id IS NULL
     OR (TG_OP = 'UPDATE' AND OLD.status = 'COMPLETED' AND lower(coalesce(OLD.payment_status, '')) = 'paid') THEN
    RETURN NEW;
  END IF;

  SELECT lower(value) <> 'false' INTO loyalty_enabled
  FROM public.settings WHERE key = 'subscription_loyalty_enabled';
  loyalty_enabled := coalesce(loyalty_enabled, true);
  IF NOT loyalty_enabled THEN RETURN NEW; END IF;

  SELECT greatest(0, least(10000, value::INTEGER)) INTO renewal_points
  FROM public.settings WHERE key = 'subscription_loyalty_points_per_renewal';
  renewal_points := coalesce(renewal_points, 100);

  SELECT greatest(1, least(24, value::INTEGER)) INTO streak_months
  FROM public.settings WHERE key = 'subscription_loyalty_streak_months';
  streak_months := coalesce(streak_months, 3);

  SELECT greatest(0, least(10000, value::INTEGER)) INTO streak_bonus
  FROM public.settings WHERE key = 'subscription_loyalty_streak_bonus_points';
  streak_bonus := coalesce(streak_bonus, 100);

  subscription_key := NEW.subscription_id;
  customer_key := NEW.customer_id;
  renewal_month := date_trunc('month', coalesce(NEW.completed_at, NEW.updated_at, now()))::DATE;

  -- Idempotency guard: one renewal award per completed subscription order.
  INSERT INTO public.subscription_loyalty_events
    (customer_id, subscription_id, order_id, event_type, points_delta, description)
  VALUES
    (customer_key, subscription_key, NEW.id, 'renewal', renewal_points, 'Subscription renewal')
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO public.subscription_loyalty_streaks(subscription_id, customer_id, last_renewal_month, consecutive_months)
  VALUES (subscription_key, customer_key, NULL, 0)
  ON CONFLICT (subscription_id) DO NOTHING;

  SELECT last_renewal_month, consecutive_months
    INTO previous_month, previous_streak
  FROM public.subscription_loyalty_streaks
  WHERE subscription_id = subscription_key
  FOR UPDATE;

  IF previous_month IS NULL THEN
    next_streak := 1;
  ELSIF renewal_month = previous_month THEN
    -- Multiple completed deliveries in one calendar month do not inflate streak.
    next_streak := greatest(1, previous_streak);
  ELSIF renewal_month = (previous_month + INTERVAL '1 month')::DATE THEN
    next_streak := previous_streak + 1;
  ELSE
    next_streak := 1;
  END IF;

  UPDATE public.subscription_loyalty_streaks
  SET last_renewal_month = greatest(coalesce(last_renewal_month, renewal_month), renewal_month),
      consecutive_months = CASE
        WHEN last_renewal_month = renewal_month THEN greatest(consecutive_months, next_streak)
        ELSE next_streak
      END,
      updated_at = now()
  WHERE subscription_id = subscription_key;

  IF streak_bonus > 0 AND next_streak >= streak_months AND (previous_streak < streak_months OR previous_month IS NULL) THEN
    INSERT INTO public.subscription_loyalty_events
      (customer_id, subscription_id, order_id, event_type, points_delta, description, metadata)
    VALUES
      (customer_key, subscription_key, NEW.id, 'streak_bonus', streak_bonus,
       'Consecutive subscription renewal bonus',
       jsonb_build_object('consecutive_months', next_streak, 'threshold_months', streak_months))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_award_subscription_loyalty ON public.orders;
CREATE TRIGGER orders_award_subscription_loyalty
  AFTER INSERT OR UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.award_subscription_loyalty_points();

COMMENT ON TABLE public.subscription_loyalty_events IS
  'Append-only subscription loyalty ledger; customer balances are calculated from points_delta. Admin-controlled policy is stored in public.settings.';
COMMENT ON TABLE public.subscription_loyalty_streaks IS
  'Per-subscription consecutive calendar-month renewal streak. Duplicate deliveries in one month do not inflate the streak.';

COMMIT;
