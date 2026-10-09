-- AuroWater — Consolidated Supabase Schema (Idempotent)
-- Run this in Supabase SQL Editor. Safe to run multiple times.
-- Requires: Supabase Auth project (auth schema + auth.uid()) already provisioned.
-- Ensure auth schema functions exist (Supabase manages this, skip if error)
-- These policies require Supabase Auth to be enabled in your project dashboard

-- ═══════════════════════════════════════════════════════════════
-- EXTENSIONS
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════

-- ── profiles (extends auth.users) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer','technician','supplier','admin')),
  aurotap_id      TEXT UNIQUE,
  referral_code   TEXT UNIQUE GENERATED ALWAYS AS
                    ('AT-' || UPPER(SUBSTRING(id::text,1,6))) STORED,
  referred_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_credits INTEGER NOT NULL DEFAULT 0,
  tier            TEXT NOT NULL DEFAULT 'bronze'
                    CHECK (tier IN ('bronze','silver','gold','platinum')),
  city            TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_seen_at    TIMESTAMPTZ,
  device_token    TEXT,
  language        TEXT NOT NULL DEFAULT 'en',
  deleted_at      TIMESTAMPTZ,
  is_online       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code    TEXT UNIQUE GENERATED ALWAYS AS
    ('AT-' || UPPER(SUBSTRING(id::text,1,6))) STORED,
  ADD COLUMN IF NOT EXISTS referred_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier             TEXT NOT NULL DEFAULT 'bronze'
    CHECK (tier IN ('bronze','silver','gold','platinum')),
  ADD COLUMN IF NOT EXISTS city             TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_token     TEXT,
  ADD COLUMN IF NOT EXISTS language         TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_online        BOOLEAN NOT NULL DEFAULT false;

-- ── service_types ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_types (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  base_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit        TEXT NOT NULL DEFAULT 'per visit',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ── addresses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label       TEXT DEFAULT 'Home',
  house_flat  TEXT NOT NULL,
  area        TEXT NOT NULL,
  city        TEXT NOT NULL,
  pincode     TEXT NOT NULL,
  landmark    TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── orders ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        TEXT UNIQUE NOT NULL,
  customer_id         UUID NOT NULL REFERENCES public.profiles(id),
  supplier_id         UUID REFERENCES public.profiles(id),
  technician_id       UUID REFERENCES public.profiles(id),
  service_type_id     INTEGER NOT NULL REFERENCES public.service_types(id),
  sub_option_key      TEXT,
  address_id          UUID REFERENCES public.addresses(id),
  address_snapshot    JSONB,
  scheduled_date      DATE,
  time_slot           TEXT,
  scheduled_time      TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  base_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  convenience_fee     NUMERIC(10,2) NOT NULL DEFAULT 29,
  emergency_charge    NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier_payout     NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method      TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','online','upi','card')),
  payment_status      TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid','paid','refunded')),
  payout_status       TEXT NOT NULL DEFAULT 'pending'
                        CHECK (payout_status IN ('pending','processing','paid')),
  is_emergency        BOOLEAN NOT NULL DEFAULT false,
  cancellation_reason TEXT,
  notes               TEXT,
  can_quantity        INTEGER,
  can_price_per_unit  NUMERIC(10,2),
  can_order_type      TEXT CHECK (can_order_type IS NULL OR can_order_type IN ('one_time','subscription')),
  can_frequency       TEXT CHECK (can_frequency IS NULL OR can_frequency IN ('daily','alternate','weekly')),
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  rating              SMALLINT CHECK (rating BETWEEN 1 AND 5),
  review_text         TEXT,
  otp                 TEXT,
  otp_verified        BOOLEAN NOT NULL DEFAULT false,
  source              TEXT DEFAULT 'web',
  promo_code          TEXT,
  discount_amount     NUMERIC(10,2) DEFAULT 0,
  final_amount        NUMERIC(10,2),
  assigned_at         TIMESTAMPTZ,
  notified_at         TIMESTAMPTZ,
  has_review          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS completed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason     TEXT,
  ADD COLUMN IF NOT EXISTS rating            SMALLINT CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS review_text       TEXT,
  ADD COLUMN IF NOT EXISTS otp               TEXT,
  ADD COLUMN IF NOT EXISTS otp_verified      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source            TEXT DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS promo_code        TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount   NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS assigned_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_review        BOOLEAN NOT NULL DEFAULT false;

-- ── settings (key-value) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── payouts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.profiles(id),
  amount      NUMERIC(10,2) NOT NULL,
  method      TEXT,
  reference   TEXT,
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT
);

-- ── reviews ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reviews_order_unique UNIQUE (order_id)
);

-- ── notifications ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'system',
  order_id    UUID REFERENCES public.orders(id),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  dedup_key   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── referral_credits ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── promo_codes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  discount_pct  SMALLINT DEFAULT 0,
  discount_flat NUMERIC(10,2) DEFAULT 0,
  max_uses      INTEGER DEFAULT 100,
  used_count    INTEGER DEFAULT 0,
  valid_from    TIMESTAMPTZ DEFAULT now(),
  valid_until   TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT true
);

-- ── push_tokens ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT CHECK (platform IN ('web','android','ios')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- ── audit_logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   UUID,
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── technician_jobs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.technician_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES public.profiles(id),
  order_id        UUID REFERENCES public.orders(id),
  status          TEXT NOT NULL DEFAULT 'PENDING',
  completed_at    TIMESTAMPTZ,
  otp             TEXT,
  otp_verified    BOOLEAN NOT NULL DEFAULT false,
  customer_rating SMALLINT CHECK (customer_rating BETWEEN 1 AND 5),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── contact_submissions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── founding_members ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.founding_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── applications (minimal stub) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.applications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── fraud_flags (minimal stub) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolved   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS founding_members_phone_key
  ON public.founding_members (phone)
  WHERE phone IS NOT NULL AND phone <> '';

DROP INDEX IF EXISTS notifications_user_dedup_key_idx;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_key_idx
  ON public.notifications (dedup_key)
  WHERE dedup_key IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- ── customer tier / last seen / final_amount helpers ───────────
CREATE OR REPLACE FUNCTION public.update_customer_tier()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.profiles SET tier = CASE
    WHEN (SELECT COUNT(*) FROM public.orders
          WHERE customer_id = NEW.customer_id
            AND status = 'COMPLETED') >= 100 THEN 'platinum'
    WHEN (SELECT COUNT(*) FROM public.orders
          WHERE customer_id = NEW.customer_id
            AND status = 'COMPLETED') >= 50  THEN 'gold'
    WHEN (SELECT COUNT(*) FROM public.orders
          WHERE customer_id = NEW.customer_id
            AND status = 'COMPLETED') >= 20  THEN 'silver'
    ELSE 'bronze'
  END
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_tier ON public.orders;
CREATE TRIGGER trg_update_tier
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW WHEN (NEW.status = 'COMPLETED')
  EXECUTE FUNCTION public.update_customer_tier();

CREATE OR REPLACE FUNCTION public.set_order_final_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.final_amount := GREATEST(0,
    COALESCE(NEW.total_amount, 0) - COALESCE(NEW.discount_amount, 0));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_final_amount ON public.orders;
CREATE TRIGGER trg_final_amount
  BEFORE INSERT OR UPDATE OF total_amount, discount_amount ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_final_amount();

CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET last_seen_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_last_seen ON auth.users;
CREATE TRIGGER trg_update_last_seen
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.update_last_seen();

-- ── generic updated_at trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── order number generator ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  candidate TEXT;
  tries INT := 0;
BEGIN
  LOOP
    candidate := 'AW-' || lpad((floor(random() * 100000000))::text, 8, '0');
    tries := tries + 1;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = candidate);
    EXIT WHEN tries > 50;
  END LOOP;
  IF tries > 50 THEN
    candidate := 'AW-' || replace(gen_random_uuid()::text, '-', '');
    candidate := left(candidate, 11);
  END IF;
  RETURN candidate;
END;
$$;

ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT (public.generate_order_number());

-- ── Supabase Auth → profiles bootstrap ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
  phone_val TEXT;
BEGIN
  r := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  IF r NOT IN ('customer','technician','supplier','admin') THEN
    r := 'customer';
  END IF;
  phone_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    phone_val,
    r
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aurowater_on_auth_user_created ON auth.users;
CREATE TRIGGER aurowater_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── customer stats function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_customer_stats(p_customer_id UUID)
RETURNS TABLE (
  total_orders BIGINT,
  completed_orders BIGINT,
  total_spent NUMERIC,
  estimated_savings NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE o.status = 'COMPLETED')::BIGINT,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED' AND o.payment_status = 'paid'), 0)::NUMERIC,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED') * 0.35, 0)::NUMERIC
  FROM public.orders o
  WHERE o.customer_id = p_customer_id;
$$;

-- ── supplier earnings function ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_supplier_earnings(p_supplier_id UUID, p_period TEXT)
RETURNS TABLE (
  period_label TEXT,
  order_count BIGINT,
  gross_amount NUMERIC,
  pending_payout NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_ts TIMESTAMPTZ;
  pl TEXT;
BEGIN
  pl := lower(coalesce(p_period, 'month'));
  start_ts := CASE pl
    WHEN 'today' THEN date_trunc('day', NOW())
    WHEN 'week' THEN date_trunc('week', NOW())
    WHEN 'month' THEN date_trunc('month', NOW())
    ELSE date_trunc('month', NOW())
  END;

  RETURN QUERY
  SELECT
    pl::TEXT,
    COUNT(*)::BIGINT,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'), 0)::NUMERIC,
    COALESCE(SUM(o.supplier_payout) FILTER (WHERE o.payout_status = 'pending'), 0)::NUMERIC
  FROM public.orders o
  WHERE o.supplier_id = p_supplier_id
    AND o.created_at >= start_ts;
END;
$$;

-- ── helper: current_profile_role (used in RLS) ──────────────────
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) & POLICIES
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on core tables
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags        ENABLE ROW LEVEL SECURITY;

-- profiles policies
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = id OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- service_types policies
DROP POLICY IF EXISTS "service_types_select_all" ON public.service_types;
CREATE POLICY "service_types_select_all" ON public.service_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_types_write_admin" ON public.service_types;
CREATE POLICY "service_types_write_admin" ON public.service_types
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- addresses policies
DROP POLICY IF EXISTS "addresses_crud_own" ON public.addresses;
CREATE POLICY "addresses_crud_own" ON public.addresses
  FOR ALL USING (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

-- orders policies
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
CREATE POLICY "orders_select_policy" ON public.orders
  FOR SELECT USING (
    customer_id = auth.uid()
    OR supplier_id = auth.uid()
    OR technician_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "orders_insert_customer" ON public.orders;
CREATE POLICY "orders_insert_customer" ON public.orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_roles" ON public.orders;
CREATE POLICY "orders_update_roles" ON public.orders
  FOR UPDATE USING (
    customer_id = auth.uid()
    OR supplier_id = auth.uid()
    OR technician_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR supplier_id = auth.uid()
    OR technician_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;
CREATE POLICY "orders_delete_admin" ON public.orders
  FOR DELETE USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- referral_credits policies
DROP POLICY IF EXISTS "referral_credits_select_own" ON public.referral_credits;
CREATE POLICY "referral_credits_select_own" ON public.referral_credits
  FOR SELECT USING (user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "referral_credits_insert_admin" ON public.referral_credits;
CREATE POLICY "referral_credits_insert_admin" ON public.referral_credits
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- promo_codes policies
DROP POLICY IF EXISTS "promo_codes_select_active" ON public.promo_codes;
CREATE POLICY "promo_codes_select_active" ON public.promo_codes
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "promo_codes_write_admin" ON public.promo_codes;
CREATE POLICY "promo_codes_write_admin" ON public.promo_codes
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- push_tokens policies
DROP POLICY IF EXISTS "push_tokens_crud_own" ON public.push_tokens;
CREATE POLICY "push_tokens_crud_own" ON public.push_tokens
  FOR ALL USING (user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin');

-- audit_logs policies
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT USING (COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin" ON public.audit_logs
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- settings policies
DROP POLICY IF EXISTS "settings_select_all" ON public.settings;
CREATE POLICY "settings_select_all" ON public.settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_write_admin" ON public.settings;
CREATE POLICY "settings_write_admin" ON public.settings
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings
  FOR UPDATE USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- payouts policies
DROP POLICY IF EXISTS "payouts_select" ON public.payouts;
CREATE POLICY "payouts_select" ON public.payouts
  FOR SELECT USING (
    supplier_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "payouts_write_admin" ON public.payouts;
CREATE POLICY "payouts_write_admin" ON public.payouts
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- reviews policies
DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert_customer" ON public.reviews;
CREATE POLICY "reviews_insert_customer" ON public.reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- notifications policies
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "notifications_insert_admin" ON public.notifications;
CREATE POLICY "notifications_insert_admin" ON public.notifications
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- contact_submissions policies
DROP POLICY IF EXISTS "contact_select_admin" ON public.contact_submissions;
DROP POLICY IF EXISTS "contact_insert_any" ON public.contact_submissions;
CREATE POLICY "contact_select_admin" ON public.contact_submissions
  FOR SELECT USING (COALESCE(public.current_profile_role(), '') = 'admin');
CREATE POLICY "contact_insert_any" ON public.contact_submissions
  FOR INSERT WITH CHECK (true);

-- founding_members policies
DROP POLICY IF EXISTS "founding_select_all" ON public.founding_members;
CREATE POLICY "founding_select_all" ON public.founding_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "founding_insert_own" ON public.founding_members;
CREATE POLICY "founding_insert_own" ON public.founding_members
  FOR INSERT WITH CHECK (true);

-- applications / fraud_flags policies
DROP POLICY IF EXISTS "applications_admin_all" ON public.applications;
CREATE POLICY "applications_admin_all" ON public.applications
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "fraud_flags_admin_all" ON public.fraud_flags;
CREATE POLICY "fraud_flags_admin_all" ON public.fraud_flags
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA (SAFE / UPSERT STYLE)
-- ═══════════════════════════════════════════════════════════════

-- service catalogue
INSERT INTO public.service_types (key, name, description, base_price, unit, is_active, sort_order) VALUES
  ('water_can', 'Water Can (20L)', 'Sealed 20L drinking-water can; supplier-specific quality and availability confirmed before order.', 39, 'per can', true, 1),
  ('water_tanker', 'Water Tanker', 'Bulk water delivery via tanker.', 299, 'per delivery', true, 2),
  ('ro_service', 'RO Service & Repair', 'RO purifier service, filter change, AMC.', 199, 'per visit', true, 3),
  ('plumbing', 'Plumbing', 'Pipe fitting, leakage repair, installation.', 149, 'per visit', true, 4),
  ('borewell', 'Borewell Services', 'Borewell drilling, repair, motor fitting.', 499, 'per service', true, 5),
  ('motor_pump', 'Motor & Pump Repair', 'Submersible motor repair, pump installation.', 249, 'per visit', true, 6),
  ('tank_cleaning', 'Water Tank Cleaning', 'Overhead/underground tank cleaning.', 349, 'per tank', true, 7)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  unit = EXCLUDED.unit,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- default settings
INSERT INTO public.settings (key, value) VALUES
  ('default_can_price',        '39'),
  ('subscription_can_price',   '37'),
  ('bulk_can_price',           '35'),
  ('bulk_threshold',           '50'),
  ('market_can_price',         '50'),
  ('water_tanker_price',       '299'),
  ('ro_service_price',         '349'),
  ('plumbing_price',           '149'),
  ('borewell_price',           '499'),
  ('motor_pump_price',         '299'),
  ('tank_cleaning_price',      '599'),
  ('convenience_fee',          '29'),
  ('emergency_surcharge',      '199'),
  ('gst_rate',                 '18'),
  ('bulk_commission',          '8'),
  ('technician_commission',    '50'),
  ('supplier_commission',      '30'),
  ('support_email',            'support.aurotap@gmail.com'),
  ('secondary_email',          'aurotap@gmail.com'),
  ('phone_primary',            '9889305803'),
  ('phone_secondary',          ''),
  ('office_address',           'Kanpur, Uttar Pradesh'),
  ('working_hours',            '09:00–21:00 IST'),
  ('brand_name',               'Auro Water'),
  ('whatsapp_enabled',         '1'),
  ('service_base_prices',      '{"water_tanker":299,"ro_service":349,"plumbing":149,"borewell":499,"motor_pump":299,"tank_cleaning":599}')
ON CONFLICT (key) DO NOTHING;

-- ensure profile display IDs for existing rows
UPDATE public.profiles
SET aurotap_id = 'AW-' || upper(left(replace(id::text, '-', ''), 8))
WHERE aurotap_id IS NULL OR trim(both from aurotap_id) = '';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

