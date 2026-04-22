-- RLS policies for AuroWater (Supabase)
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ── Helper: current profile role (avoids recursion in simple cases) ──
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── profiles ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = id OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

-- No DELETE: soft-delete only (deleted_at)
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- Inserts handled by trigger / service role on signup
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── service_types (public read active; admin write) ─────────────────
DROP POLICY IF EXISTS "service_types_select_all" ON public.service_types;
CREATE POLICY "service_types_select_all" ON public.service_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_types_write_admin" ON public.service_types;
CREATE POLICY "service_types_write_admin" ON public.service_types
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── addresses ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "addresses_crud_own" ON public.addresses;
CREATE POLICY "addresses_crud_own" ON public.addresses
  FOR ALL USING (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

-- ── orders ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
CREATE POLICY "orders_select_policy" ON public.orders
  FOR SELECT USING (
    customer_id = auth.uid()
    OR supplier_id = auth.uid()
    OR technician_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "orders_insert_customer" ON public.orders;
CREATE POLICY "orders_insert_customer" ON public.orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_roles" ON public.orders;
CREATE POLICY "orders_update_roles" ON public.orders
  FOR UPDATE USING (
    customer_id = auth.uid()
    OR supplier_id = auth.uid()
    OR technician_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR supplier_id = auth.uid()
    OR technician_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;
CREATE POLICY "orders_delete_admin" ON public.orders
  FOR DELETE USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── referral_credits (select own; inserts via service role/admin) ───
DROP POLICY IF EXISTS "referral_credits_select_own" ON public.referral_credits;
CREATE POLICY "referral_credits_select_own" ON public.referral_credits
  FOR SELECT USING (user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "referral_credits_insert_admin" ON public.referral_credits;
CREATE POLICY "referral_credits_insert_admin" ON public.referral_credits
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── promo_codes (public read active; admin write) ───────────────────
DROP POLICY IF EXISTS "promo_codes_select_active" ON public.promo_codes;
CREATE POLICY "promo_codes_select_active" ON public.promo_codes
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "promo_codes_write_admin" ON public.promo_codes;
CREATE POLICY "promo_codes_write_admin" ON public.promo_codes
  FOR ALL USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── push_tokens (CRUD own) ──────────────────────────────────────────
DROP POLICY IF EXISTS "push_tokens_crud_own" ON public.push_tokens;
CREATE POLICY "push_tokens_crud_own" ON public.push_tokens
  FOR ALL USING (user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin');

-- ── audit_logs (admin read; inserts via service role/admin) ─────────
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT USING (COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin" ON public.audit_logs
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── settings ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_select_all" ON public.settings;
CREATE POLICY "settings_select_all" ON public.settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_write_admin" ON public.settings;
CREATE POLICY "settings_write_admin" ON public.settings
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings
  FOR UPDATE USING (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── payouts ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payouts_select" ON public.payouts;
CREATE POLICY "payouts_select" ON public.payouts
  FOR SELECT USING (
    supplier_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "payouts_write_admin" ON public.payouts;
CREATE POLICY "payouts_write_admin" ON public.payouts
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── reviews ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert_customer" ON public.reviews;
CREATE POLICY "reviews_insert_customer" ON public.reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- ── notifications ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
    OR COALESCE(public.current_profile_role(), '') = 'admin'
  );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid() OR COALESCE(public.current_profile_role(), '') = 'admin');

DROP POLICY IF EXISTS "notifications_insert_admin" ON public.notifications;
CREATE POLICY "notifications_insert_admin" ON public.notifications
  FOR INSERT WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

-- ── contact_submissions (public insert for contact form; admin read) ─
DROP POLICY IF EXISTS "contact_select_admin" ON public.contact_submissions;
DROP POLICY IF EXISTS "contact_insert_any" ON public.contact_submissions;
CREATE POLICY "contact_select_admin" ON public.contact_submissions
  FOR SELECT USING (COALESCE(public.current_profile_role(), '') = 'admin');
CREATE POLICY "contact_insert_any" ON public.contact_submissions
  FOR INSERT WITH CHECK (true);

-- ── founding_members ────────────────────────────────────────────────
DROP POLICY IF EXISTS "founding_select_all" ON public.founding_members;
CREATE POLICY "founding_select_all" ON public.founding_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "founding_insert_own" ON public.founding_members;
CREATE POLICY "founding_insert_own" ON public.founding_members
  FOR INSERT WITH CHECK (true);
