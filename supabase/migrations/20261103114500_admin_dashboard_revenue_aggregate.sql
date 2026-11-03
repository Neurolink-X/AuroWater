-- Efficient revenue snapshot for the Admin Dashboard.
-- Strictly server-only via service_role; the route verifies Admin auth first.
-- Read-only: no customer, order, ledger, payment or payout writes.
-- Replaces four independently fetched revenue/unpaid-row arrays with one SQL
-- aggregate; handles more than the PostgREST default row-return limit.

CREATE OR REPLACE FUNCTION public.admin_dashboard_revenue_aggregate(
  p_today timestamptz,
  p_previous_start timestamptz,
  p_previous_end timestamptz
)
RETURNS TABLE (
  total_revenue numeric,
  revenue_today numeric,
  revenue_previous_week numeric,
  unpaid_completed_orders bigint,
  unpaid_completed_amount numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
  SELECT
    COALESCE(sum(o.total_amount), 0)::numeric,
    COALESCE(sum(o.total_amount) FILTER (WHERE o.created_at >= p_today), 0)::numeric,
    COALESCE(sum(o.total_amount) FILTER (
      WHERE o.created_at >= p_previous_start
        AND o.created_at < p_previous_end
    ), 0)::numeric,
    count(*) FILTER (WHERE o.payment_status='unpaid')::bigint,
    COALESCE(sum(o.total_amount) FILTER (
      WHERE o.payment_status='unpaid'
    ), 0)::numeric
  FROM public.orders o
  WHERE o.status='COMPLETED';
$function$;

REVOKE ALL ON FUNCTION public.admin_dashboard_revenue_aggregate(timestamptz,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_revenue_aggregate(timestamptz,timestamptz,timestamptz)
  TO service_role;
