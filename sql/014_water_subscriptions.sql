-- AuroTap — real recurring water-can subscriptions
-- Migration: 014_water_subscriptions.sql
-- Safe to run more than once.
--
-- IMPORTANT:
-- This migration intentionally contains NO DO $$ blocks.
-- It is safe to paste directly into Supabase SQL Editor.

BEGIN;

-- ============================================================
-- 1. Extend orders for recurring water deliveries
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS can_price_per_unit NUMERIC(10,2);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS can_order_type TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS can_frequency TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subscription_id UUID;

-- Remove old frequency/type checks before recreating them.
-- The current AuroTap schema uses these constraint names.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_can_frequency_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_can_frequency_check
  CHECK (
    can_frequency IS NULL
    OR can_frequency IN (
      'daily',
      'alternate',
      'weekly',
      'biweekly',
      'monthly'
    )
  );

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_can_order_type_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_can_order_type_check
  CHECK (
    can_order_type IS NULL
    OR can_order_type IN (
      'one_time',
      'subscription'
    )
  );

-- In case an earlier failed attempt created this FK name.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_subscription_fk;

-- ============================================================
-- 2. Subscription master record
-- ============================================================

CREATE TABLE IF NOT EXISTS public.water_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  address_id UUID NOT NULL
    REFERENCES public.addresses(id)
    ON DELETE RESTRICT,

  first_order_id UUID
    REFERENCES public.orders(id)
    ON DELETE SET NULL,

  last_order_id UUID
    REFERENCES public.orders(id)
    ON DELETE SET NULL,

  quantity INTEGER NOT NULL
    CHECK (quantity BETWEEN 1 AND 200),

  frequency TEXT NOT NULL
    CHECK (
      frequency IN (
        'daily',
        'alternate',
        'weekly',
        'biweekly',
        'monthly'
      )
    ),

  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (
      status IN (
        'ACTIVE',
        'PAUSED',
        'CANCELLED'
      )
    ),

  start_date DATE NOT NULL,

  next_order_date DATE NOT NULL,

  preferred_time_slot TEXT NOT NULL,

  preferred_start_time TIME NOT NULL,

  preferred_end_time TIME NOT NULL,

  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (
      payment_method IN (
        'cash',
        'upi'
      )
    ),

  price_per_can NUMERIC(10,2) NOT NULL
    CHECK (price_per_can >= 0),

  convenience_fee NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (convenience_fee >= 0),

  gst_rate NUMERIC(6,5) NOT NULL DEFAULT 0
    CHECK (
      gst_rate >= 0
      AND gst_rate <= 1
    ),

  notes TEXT,

  pause_reason TEXT,

  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW()
);

-- Link orders to their subscription after the target table exists.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_subscription_fk
  FOREIGN KEY (subscription_id)
  REFERENCES public.water_subscriptions(id)
  ON DELETE SET NULL;

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS
  water_subscriptions_customer_idx
ON public.water_subscriptions(customer_id);

CREATE INDEX IF NOT EXISTS
  water_subscriptions_status_next_order_idx
ON public.water_subscriptions(
  status,
  next_order_date
);

CREATE INDEX IF NOT EXISTS
  water_subscriptions_address_idx
ON public.water_subscriptions(address_id);

CREATE INDEX IF NOT EXISTS
  orders_subscription_idx
ON public.orders(subscription_id);

CREATE UNIQUE INDEX IF NOT EXISTS
  orders_subscription_schedule_unique_idx
ON public.orders(
  subscription_id,
  scheduled_at
)
WHERE subscription_id IS NOT NULL
  AND scheduled_at IS NOT NULL;

-- ============================================================
-- 4. updated_at
-- ============================================================

DROP TRIGGER IF EXISTS
  water_subscriptions_updated_at
ON public.water_subscriptions;

CREATE TRIGGER
  water_subscriptions_updated_at
BEFORE UPDATE ON public.water_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 5. Row Level Security
-- ============================================================

ALTER TABLE public.water_subscriptions
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  "water_subscriptions_customer_select"
ON public.water_subscriptions;

CREATE POLICY
  "water_subscriptions_customer_select"
ON public.water_subscriptions
FOR SELECT
USING (
  customer_id = auth.uid()
  OR COALESCE(
    public.current_profile_role(),
    ''
  ) = 'admin'
);

DROP POLICY IF EXISTS
  "water_subscriptions_admin_all"
ON public.water_subscriptions;

CREATE POLICY
  "water_subscriptions_admin_all"
ON public.water_subscriptions
FOR ALL
USING (
  COALESCE(
    public.current_profile_role(),
    ''
  ) = 'admin'
)
WITH CHECK (
  COALESCE(
    public.current_profile_role(),
    ''
  ) = 'admin'
);

-- ============================================================
-- 6. PostgREST refresh
-- ============================================================

SELECT pg_notify(
  'pgrst',
  'reload schema'
);

COMMIT;
