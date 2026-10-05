-- ============================================================
-- AuroWater Service Quality System
-- ============================================================

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS feedback_tags JSONB
  NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS issue_category TEXT;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS issue_description TEXT;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'LOW';


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
      severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
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

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_quality_cases_order
  ON public.service_quality_cases(order_id);

CREATE INDEX IF NOT EXISTS idx_quality_cases_customer
  ON public.service_quality_cases(customer_id);

CREATE INDEX IF NOT EXISTS idx_quality_cases_supplier
  ON public.service_quality_cases(supplier_id);

CREATE INDEX IF NOT EXISTS idx_quality_cases_technician
  ON public.service_quality_cases(technician_id);

CREATE INDEX IF NOT EXISTS idx_quality_cases_status
  ON public.service_quality_cases(status);

CREATE INDEX IF NOT EXISTS idx_quality_cases_severity
  ON public.service_quality_cases(severity);
