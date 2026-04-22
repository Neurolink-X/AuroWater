-- AuroWater — core schema (Supabase / PostgreSQL)
-- Idempotent: safe to run multiple times.
-- Requires: auth.users (Supabase Auth)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users (extends Supabase auth.users) ─────────────────────────────
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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill / forward-compat for older core migrations
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
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

-- ── Service types ───────────────────────────────────────────────────
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

-- ── Addresses ───────────────────────────────────────────────────────
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

-- ── Orders ──────────────────────────────────────────────────────────
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
  ADD COLUMN IF NOT EXISTS notified_at       TIMESTAMPTZ;

-- ── Settings (key-value) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payouts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.profiles(id),
  amount      NUMERIC(10,2) NOT NULL,
  method      TEXT,
  reference   TEXT,
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT
);

-- ── Reviews ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reviews_order_unique UNIQUE (order_id)
);

-- ── Notifications ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'system',
  order_id    UUID REFERENCES public.orders(id),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Referral credits ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Promo codes ─────────────────────────────────────────────────────
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

-- ── Push tokens ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT CHECK (platform IN ('web','android','ios')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- ── Audit logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   UUID,
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Technician jobs (if used by technician role) ────────────────────
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

-- ── supplier_settings schema extensions (guarded) ───────────────────
DO $$
BEGIN
  IF to_regclass('public.supplier_settings') IS NOT NULL THEN
    ALTER TABLE public.supplier_settings
      ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS total_earned   NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pending_payout NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- ── technician_jobs schema extensions (guarded) ─────────────────────
DO $$
BEGIN
  IF to_regclass('public.technician_jobs') IS NOT NULL THEN
    ALTER TABLE public.technician_jobs
      ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS otp             TEXT,
      ADD COLUMN IF NOT EXISTS otp_verified    BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS customer_rating SMALLINT CHECK (customer_rating BETWEEN 1 AND 5);
  END IF;
END $$;

-- ── Functions & triggers (customer tier + final amount + last seen) ─
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

-- ── Contact submissions (marketing / support) ───────────────────────
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Founding members counter (social proof) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.founding_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS founding_members_phone_key ON public.founding_members (phone)
  WHERE phone IS NOT NULL AND phone <> '';
