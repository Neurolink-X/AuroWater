-- AuroWater / AuroTap: profiles privilege and row-integrity hardening.
-- Forward-only, idempotent. Apply after reviewing on staging first.
-- Public technician discovery is moved to a server-only service-role API.
-- Authenticated users retain own-row access; protected account fields are server/admin managed.

BEGIN;

-- Remove permissive legacy policies. Policies scoped to PUBLIC are inherited by
-- anon and authenticated, so recreate them explicitly for authenticated users.
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_service_all ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_public_read_technicians ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- No anonymous access to the raw profile table. Authenticated reads are limited
-- to the caller's own row or admins. Trusted server code uses service_role.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon;
-- Column-level grants are independent of table-level grants; remove those too.
DO $block$
DECLARE
  v_columns text;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles';

  IF v_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE ALL (%s) ON TABLE public.profiles FROM PUBLIC, anon',
      v_columns
    );
    EXECUTE format(
      'REVOKE INSERT (%s), REFERENCES (%s) ON TABLE public.profiles FROM authenticated',
      v_columns, v_columns
    );
    EXECUTE format(
      'REVOKE UPDATE (%s) ON TABLE public.profiles FROM authenticated',
      v_columns
    );
  END IF;
END;
$block$;
GRANT SELECT ON TABLE public.profiles TO authenticated;
-- Only profile/preferences/availability fields may be changed by the signed-in user.
-- Role, approval, counters, referral balances and account state remain server-managed.
GRANT UPDATE (
  full_name, phone, city, avatar_url, language, whatsapp, settings,
  is_online, availability_status, current_lat, current_lng, last_seen_at, updated_at, device_token
) ON TABLE public.profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;

CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY profiles_update_own_or_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY profiles_admin_delete
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Profile creation remains in the trusted auth trigger / server-side service flow.
-- No INSERT policy is granted to authenticated users.

-- RLS controls rows, not columns. Protect role, approval, account state, referral
-- balances, and other security-sensitive fields even when a user updates their
-- own profile row. Legitimate availability/location updates remain permitted.
CREATE OR REPLACE FUNCTION public.guard_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_is_trusted boolean := COALESCE(auth.role(), '') = 'service_role';
  v_is_admin boolean := false;
BEGIN
  IF v_is_trusted THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT COALESCE(public.is_admin(), false) INTO v_is_admin;
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.referral_credits IS DISTINCT FROM OLD.referral_credits
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.completed_orders IS DISTINCT FROM OLD.completed_orders
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.milestone_tier IS DISTINCT FROM OLD.milestone_tier
     OR NEW.aurotap_id IS DISTINCT FROM OLD.aurotap_id
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  THEN
    RAISE EXCEPTION 'Protected profile fields can only be changed by an administrator'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_profile_security_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_profile_security_fields() TO service_role;

DROP TRIGGER IF EXISTS trg_guard_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_security_fields();

NOTIFY pgrst, 'reload schema';

COMMIT;
