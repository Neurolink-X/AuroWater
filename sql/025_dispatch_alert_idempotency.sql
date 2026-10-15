-- AuroTap: prevent retry loops from flooding notifications and audit_logs.
-- Additive and idempotent. Existing historical audit records are preserved.
BEGIN;

CREATE TABLE IF NOT EXISTS public.dispatch_alert_events (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (
    action IN (
      'no_supplier',
      'dispatch_exhausted',
      'technician_no_candidates',
      'technician_dispatch_exhausted'
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, action)
);

ALTER TABLE public.dispatch_alert_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dispatch_alert_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.dispatch_alert_events TO service_role;

-- Seed the dedup table for already-completed orders so the next cron run does
-- not generate another alert for historical failures that were later completed.
INSERT INTO public.dispatch_alert_events (order_id, action)
SELECT DISTINCT
  o.id,
  replace(a.action, 'order.', '')
FROM public.orders AS o
JOIN public.audit_logs AS a
  ON a.entity_id::text IN (o.id::text, o.order_number)
WHERE o.status = 'COMPLETED'
  AND a.action IN (
    'order.no_supplier',
    'order.dispatch_exhausted',
    'order.technician_no_candidates',
    'order.technician_dispatch_exhausted'
  )
ON CONFLICT (order_id, action) DO NOTHING;

COMMIT;
