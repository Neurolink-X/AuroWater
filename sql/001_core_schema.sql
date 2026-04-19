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
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
