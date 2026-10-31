-- Pin function name resolution to trusted schemas and remove caller-controlled
-- search_path variability. Preserves the existing public + extensions lookup.
-- No function bodies, table RLS, triggers, or privileges are changed.
BEGIN;
ALTER FUNCTION public.generate_order_number() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.generate_referral_code() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.is_admin() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.prevent_order_pricing_snapshot_mutation() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.prevent_pricing_version_mutation() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.prevent_subscription_pricing_snapshot_mutation() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.set_assigned_at() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.set_order_final_amount() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.update_customer_tier() SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.update_updated_at() SET search_path = pg_catalog, public, extensions;
COMMIT;
