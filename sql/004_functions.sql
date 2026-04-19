-- Functions, triggers, auth profile bootstrap

-- ── 1) Order number generator ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  candidate TEXT;
  tries INT := 0;
BEGIN
  LOOP
    candidate := 'AW-' || lpad((floor(random() * 100000000))::text, 8, '0');
    tries := tries + 1;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = candidate);
    EXIT WHEN tries > 50;
  END LOOP;
  IF tries > 50 THEN
    candidate := 'AW-' || replace(gen_random_uuid()::text, '-', '');
    candidate := left(candidate, 11);
  END IF;
  RETURN candidate;
END;
$$;

-- ── 2) updated_at trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3) New Supabase Auth user → profile row ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
  phone_val TEXT;
BEGIN
  r := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  IF r NOT IN ('customer','technician','supplier','admin') THEN
    r := 'customer';
  END IF;
  phone_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    phone_val,
    r
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aurowater_on_auth_user_created ON auth.users;
CREATE TRIGGER aurowater_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 4) Customer stats ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_customer_stats(p_customer_id UUID)
RETURNS TABLE (
  total_orders BIGINT,
  completed_orders BIGINT,
  total_spent NUMERIC,
  estimated_savings NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE o.status = 'COMPLETED')::BIGINT,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED' AND o.payment_status = 'paid'), 0)::NUMERIC,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED') * 0.35, 0)::NUMERIC
  FROM public.orders o
  WHERE o.customer_id = p_customer_id;
$$;

-- ── 5) Supplier earnings by period ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_supplier_earnings(p_supplier_id UUID, p_period TEXT)
RETURNS TABLE (
  period_label TEXT,
  order_count BIGINT,
  gross_amount NUMERIC,
  pending_payout NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_ts TIMESTAMPTZ;
  pl TEXT;
BEGIN
  pl := lower(coalesce(p_period, 'month'));
  start_ts := CASE pl
    WHEN 'today' THEN date_trunc('day', NOW())
    WHEN 'week' THEN date_trunc('week', NOW())
    WHEN 'month' THEN date_trunc('month', NOW())
    ELSE date_trunc('month', NOW())
  END;

  RETURN QUERY
  SELECT
    pl::TEXT,
    COUNT(*)::BIGINT,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'), 0)::NUMERIC,
    COALESCE(SUM(o.supplier_payout) FILTER (WHERE o.payout_status = 'pending'), 0)::NUMERIC
  FROM public.orders o
  WHERE o.supplier_id = p_supplier_id
    AND o.created_at >= start_ts;
END;
$$;

-- Default order numbers when not supplied by app
ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT (public.generate_order_number());
