-- AuroTap — Service Quality & Customer Feedback
-- Migration: 012_service_quality.sql
-- Safe to run more than once.

BEGIN;

-- ============================================================
-- 1. Extend reviews
-- ============================================================

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS feedback_tags JSONB
    NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS issue_category TEXT;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS issue_description TEXT;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS severity TEXT;

-- Existing rows must have a valid severity before NOT NULL.
UPDATE public.reviews
SET severity = 'LOW'
WHERE severity IS NULL
   OR severity NOT IN (
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL'
   );

ALTER TABLE public.reviews
  ALTER COLUMN severity SET DEFAULT 'LOW';

ALTER TABLE public.reviews
  ALTER COLUMN severity SET NOT NULL;

-- Add the constraint only when it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_severity_check'
      AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_severity_check
      CHECK (
        severity IN (
          'LOW',
          'MEDIUM',
          'HIGH',
          'CRITICAL'
        )
      );
  END IF;
END
$$;

-- ============================================================
-- 2. Service quality cases
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_quality_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL
    REFERENCES public.orders(id)
    ON DELETE CASCADE,

  review_id UUID
    REFERENCES public.reviews(id)
    ON DELETE SET NULL,

  customer_id UUID NOT NULL
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  supplier_id UUID
    REFERENCES public.profiles(id)
    ON DELETE SET NULL,

  technician_id UUID
    REFERENCES public.profiles(id)
    ON DELETE SET NULL,

  category TEXT NOT NULL,

  severity TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (
      severity IN (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
      )
    ),

  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (
      status IN (
        'OPEN',
        'ASSIGNED',
        'INVESTIGATING',
        'ACTION_REQUIRED',
        'ESCALATED',
        'RESOLVED',
        'CUSTOMER_CONFIRMED',
        'CLOSED'
      )
    ),

  assigned_to UUID
    REFERENCES public.profiles(id)
    ON DELETE SET NULL,

  resolution TEXT,

  customer_resolution_status TEXT
    CHECK (
      customer_resolution_status IS NULL
      OR customer_resolution_status IN (
        'YES',
        'PARTIAL',
        'NO'
      )
    ),

  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS
  service_quality_cases_order_idx
ON public.service_quality_cases(order_id);

CREATE INDEX IF NOT EXISTS
  service_quality_cases_review_idx
ON public.service_quality_cases(review_id);

CREATE INDEX IF NOT EXISTS
  service_quality_cases_customer_idx
ON public.service_quality_cases(customer_id);

CREATE INDEX IF NOT EXISTS
  service_quality_cases_supplier_idx
ON public.service_quality_cases(supplier_id);

CREATE INDEX IF NOT EXISTS
  service_quality_cases_technician_idx
ON public.service_quality_cases(technician_id);

CREATE INDEX IF NOT EXISTS
  service_quality_cases_status_idx
ON public.service_quality_cases(status);

CREATE INDEX IF NOT EXISTS
  service_quality_cases_severity_idx
ON public.service_quality_cases(severity);

-- Only one quality case should originate from one review.
CREATE UNIQUE INDEX IF NOT EXISTS
  service_quality_cases_review_unique_idx
ON public.service_quality_cases(review_id)
WHERE review_id IS NOT NULL;

-- ============================================================
-- 4. updated_at trigger
-- ============================================================

DROP TRIGGER IF EXISTS
  service_quality_cases_updated_at
ON public.service_quality_cases;

CREATE TRIGGER
  service_quality_cases_updated_at
BEFORE UPDATE ON public.service_quality_cases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE public.service_quality_cases
ENABLE ROW LEVEL SECURITY;

-- Customers can see only their own cases.
DROP POLICY IF EXISTS
  "service_quality_cases_customer_select"
ON public.service_quality_cases;

CREATE POLICY
  "service_quality_cases_customer_select"
ON public.service_quality_cases
FOR SELECT
USING (
  customer_id = auth.uid()
  OR COALESCE(
      public.current_profile_role(),
      ''
    ) = 'admin'
);

-- Admins can fully manage quality cases.
DROP POLICY IF EXISTS
  "service_quality_cases_admin_all"
ON public.service_quality_cases;

CREATE POLICY
  "service_quality_cases_admin_all"
ON public.service_quality_cases
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
-- 6. PostgREST schema refresh
-- ============================================================

SELECT pg_notify(
  'pgrst',
  'reload schema'
);

COMMIT;
