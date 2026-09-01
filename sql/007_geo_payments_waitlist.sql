-- AuroWater — geo waitlist, QR payments, agent location, notifications, push, cans
-- Apply in Supabase SQL Editor after ALL_MIGRATIONS_ORDERED.sql
-- Then: SELECT pg_notify('pgrst', 'reload schema');

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT,
  email       TEXT,
  city        TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upi_id          TEXT,
  qr_image_url    TEXT,
  bank_name       TEXT,
  account_holder  TEXT,
  account_number  TEXT,
  ifsc_code       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method           TEXT NOT NULL CHECK (method IN ('qr_scan', 'cash', 'offline')),
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'screenshot_uploaded', 'verified', 'failed')),
  amount_paise     INTEGER NOT NULL DEFAULT 0,
  screenshot_url   TEXT,
  verified_by      UUID REFERENCES auth.users(id),
  verified_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_locations (
  agent_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_lat  DOUBLE PRECISION,
  current_lng  DOUBLE PRECISION,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.otp_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS empty_cans_outstanding INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_city ON public.waitlist(city);
CREATE INDEX IF NOT EXISTS idx_otp_attempts_phone_created ON public.otp_attempts(phone, created_at DESC);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waitlist_insert ON public.waitlist;
CREATE POLICY waitlist_insert ON public.waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS waitlist_admin_read ON public.waitlist;
CREATE POLICY waitlist_admin_read ON public.waitlist FOR SELECT TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS seller_pay_own ON public.seller_payment_methods;
CREATE POLICY seller_pay_own ON public.seller_payment_methods FOR ALL TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS seller_pay_customer_read ON public.seller_payment_methods;
CREATE POLICY seller_pay_customer_read ON public.seller_payment_methods FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS order_pay_customer ON public.order_payments;
CREATE POLICY order_pay_customer ON public.order_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS order_pay_customer_insert ON public.order_payments;
CREATE POLICY order_pay_customer_insert ON public.order_payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS order_pay_seller ON public.order_payments;
CREATE POLICY order_pay_seller ON public.order_payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.supplier_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS order_pay_admin ON public.order_payments;
CREATE POLICY order_pay_admin ON public.order_payments FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS agent_loc_own ON public.agent_locations;
CREATE POLICY agent_loc_own ON public.agent_locations FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS agent_loc_customer_read ON public.agent_locations;
CREATE POLICY agent_loc_customer_read ON public.agent_locations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.technician_id = agent_locations.agent_id
        AND o.customer_id = auth.uid()
        AND o.status NOT IN ('COMPLETED', 'CANCELLED', 'delivered', 'cancelled')
    )
  );

DROP POLICY IF EXISTS push_own ON public.push_subscriptions;
CREATE POLICY push_own ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.assign_nearest_supplier(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_city TEXT;
  v_supplier UUID;
BEGIN
  SELECT a.lat, a.lng, a.city
    INTO v_lat, v_lng, v_city
  FROM public.orders o
  LEFT JOIN public.addresses a ON a.id = o.address_id
  WHERE o.id = p_order_id;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.id INTO v_supplier
  FROM public.profiles p
  WHERE p.role = 'supplier'
    AND p.is_active = true
    AND (p.city IS NULL OR lower(p.city) = lower(v_city))
    AND p.current_lat IS NOT NULL
    AND p.current_lng IS NOT NULL
    AND earth_distance(
          ll_to_earth(p.current_lat, p.current_lng),
          ll_to_earth(v_lat, v_lng)
        ) / 1000.0 <= 15
  ORDER BY earth_distance(
             ll_to_earth(p.current_lat, p.current_lng),
             ll_to_earth(v_lat, v_lng)
           )
  LIMIT 1;

  IF v_supplier IS NOT NULL THEN
    UPDATE public.orders SET supplier_id = v_supplier WHERE id = p_order_id;
  END IF;

  RETURN v_supplier;
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');
