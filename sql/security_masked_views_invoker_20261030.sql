-- SECURITY: preserve customer contact masking when switching order views to
-- security_invoker=true. Ordinary RLS hides other users' profiles, so the
-- previous simple ALTER VIEW fix would break phone/name on accepted orders.
-- View SELECT lists were captured read-only from the live database on 2026-10-30.
BEGIN;

-- Narrow, checked helper. It may bypass profiles RLS only for a currently
-- assigned supplier/technician AFTER acceptance and only for active work.
-- Direct calls with arbitrary order IDs return no rows.
CREATE OR REPLACE FUNCTION public.assignee_masked_order_contact(
  p_order_id uuid, p_actor_type text
) RETURNS TABLE(phone text, full_name text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (to_jsonb(p.*) ->> 'phone')::text,
         COALESCE(to_jsonb(p.*) ->> 'full_name', to_jsonb(p.*) ->> 'name')::text,
         NULL::text
  FROM public.orders o
  JOIN public.profiles p ON p.id = o.customer_id
  WHERE o.id = p_order_id
    AND o.accepted_at IS NOT NULL
    AND o.status IN ('ASSIGNED','IN_PROGRESS')
    AND auth.uid() IS NOT NULL
    AND (
      (p_actor_type = 'supplier' AND o.supplier_id = auth.uid()) OR
      (p_actor_type = 'technician' AND o.technician_id = auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION public.assignee_masked_order_contact(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assignee_masked_order_contact(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.supplier_orders_masked
WITH (security_barrier=true, security_invoker=true) AS
 SELECT o.id,
    o.order_number,
    o.service_type,
    o.status,
    o.can_count,
    o.can_order_type,
    o.is_emergency,
    o.note,
    o.scheduled_at,
    o.zone_id,
    o.total_amount,
    o.payment_method,
    o.payment_status,
    o.supplier_payout,
    o.payout_status,
    o.created_at,
    o.assigned_at,
    o.accepted_at,
    o.started_at,
    o.completed_at,
    o.tracking_url,
    o.supplier_note,
    ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) AS contact_visible,
        CASE
            WHEN ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) THEN o.address
            ELSE NULL::text
        END AS address,
        CASE
            WHEN ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) THEN o.address_snapshot
            ELSE NULL::jsonb
        END AS address_snapshot,
        CASE
            WHEN ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) THEN (to_jsonb(c.*) ->> 'phone'::text)
            ELSE NULL::text
        END AS customer_phone,
        CASE
            WHEN ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) THEN COALESCE((to_jsonb(c.*) ->> 'full_name'::text), (to_jsonb(c.*) ->> 'name'::text))
            ELSE NULL::text
        END AS customer_name
   FROM public.orders o
     LEFT JOIN LATERAL public.assignee_masked_order_contact(o.id, 'supplier') c ON true
  WHERE (o.supplier_id = auth.uid());

CREATE OR REPLACE VIEW public.technician_orders_masked
WITH (security_barrier=true, security_invoker=true) AS
 SELECT o.id,
    o.order_number,
    o.service_type,
    o.status,
    o.is_emergency,
    o.note,
    o.scheduled_at,
    o.zone_id,
    o.total_amount,
    o.payment_method,
    o.payment_status,
    o.supplier_payout,
    o.payout_status,
    o.created_at,
    o.assigned_at,
    o.accepted_at,
    o.started_at,
    o.completed_at,
    ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) AS contact_visible,
        CASE
            WHEN ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) THEN o.address
            ELSE NULL::text
        END AS address,
        CASE
            WHEN ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) THEN o.address_snapshot
            ELSE NULL::jsonb
        END AS address_snapshot,
        CASE
            WHEN ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) THEN (to_jsonb(c.*) ->> 'phone'::text)
            ELSE NULL::text
        END AS customer_phone,
        CASE
            WHEN ((o.accepted_at IS NOT NULL) AND (o.status = ANY (ARRAY['ASSIGNED'::text, 'IN_PROGRESS'::text]))) THEN COALESCE((to_jsonb(c.*) ->> 'full_name'::text), (to_jsonb(c.*) ->> 'name'::text))
            ELSE NULL::text
        END AS customer_name
   FROM public.orders o
     LEFT JOIN LATERAL public.assignee_masked_order_contact(o.id, 'technician') c ON true
  WHERE (o.technician_id = auth.uid());

COMMIT;

-- Staging checks REQUIRED: both views return only assigned own orders; contacts
-- are null before acceptance and available after acceptance; users cannot call
-- the helper for another actor's orders; supplier and technician screens pass.
