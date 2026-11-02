-- Customer-confirmed supplier affinity. No cash rewards or commission.
CREATE TABLE IF NOT EXISTS public.supplier_customer_relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 supplier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 referral_source text NOT NULL DEFAULT 'supplier_link' CHECK (referral_source IN ('supplier_link','customer_choice','admin_verified')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked','expired')),
 customer_confirmed_at timestamptz,
 priority_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(customer_id,supplier_id),
 CHECK (customer_id <> supplier_id),
 CHECK (status <> 'active' OR (customer_confirmed_at IS NOT NULL AND priority_expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS supplier_customer_relationships_lookup_idx
 ON public.supplier_customer_relationships(customer_id, priority_expires_at DESC)
 WHERE status='active' AND customer_confirmed_at IS NOT NULL;
ALTER TABLE public.supplier_customer_relationships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_customer_relationships FROM anon, authenticated;
-- Only trusted server-side service-role code may write referral attribution.
COMMENT ON TABLE public.supplier_customer_relationships IS 'Server-managed, customer-confirmed supplier routing priority; default 90-day expiry enforced by application.';
