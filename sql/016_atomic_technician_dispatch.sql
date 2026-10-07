-- AuroWater technician atomic dispatch, trust, OTP proof and complaint hardening.
-- Safe/idempotent. APPLY ONLY AFTER 015_atomic_supplier_stock_dispatch.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.settings (key, value)
VALUES ('technician_max_active_jobs','3'), ('technician_service_radius_km','15')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_current_lat_valid' AND conrelid='public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_current_lat_valid CHECK (current_lat IS NULL OR current_lat BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_current_lng_valid' AND conrelid='public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_current_lng_valid CHECK (current_lng IS NULL OR current_lng BETWEEN -180 AND 180);
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS technician_dispatch_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_technician_dispatch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS service_otp_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_otp_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.technician_job_dispatch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'OFFERED'
    CHECK (status IN ('OFFERED','ACCEPTED','REJECTED','EXPIRED','CANCELLED','COMPLETED')),
  distance_km NUMERIC(10,2),
  trust_score NUMERIC(6,2),
  reason TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, technician_id)
);

CREATE INDEX IF NOT EXISTS technician_job_dispatch_order_idx
  ON public.technician_job_dispatch(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS technician_job_dispatch_technician_idx
  ON public.technician_job_dispatch(technician_id, status);
CREATE INDEX IF NOT EXISTS technician_job_dispatch_status_idx
  ON public.technician_job_dispatch(status);

ALTER TABLE public.technician_job_dispatch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS technician_dispatch_technician_read ON public.technician_job_dispatch;
CREATE POLICY technician_dispatch_technician_read
  ON public.technician_job_dispatch FOR SELECT TO authenticated
  USING (technician_id = auth.uid());

DROP POLICY IF EXISTS technician_dispatch_customer_read ON public.technician_job_dispatch;
CREATE POLICY technician_dispatch_customer_read
  ON public.technician_job_dispatch FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = technician_job_dispatch.order_id
      AND o.customer_id = auth.uid()
  ));

DROP POLICY IF EXISTS technician_dispatch_admin_all ON public.technician_job_dispatch;
CREATE POLICY technician_dispatch_admin_all
  ON public.technician_job_dispatch FOR ALL TO authenticated
  USING (COALESCE(public.current_profile_role(), '') = 'admin')
  WITH CHECK (COALESCE(public.current_profile_role(), '') = 'admin');

REVOKE INSERT, UPDATE, DELETE ON public.technician_job_dispatch FROM authenticated;
GRANT SELECT ON public.technician_job_dispatch TO authenticated;

CREATE OR REPLACE FUNCTION public.try_assign_technician(
  p_order_id UUID,
  p_technician_id UUID,
  p_distance_km NUMERIC DEFAULT NULL,
  p_trust_score NUMERIC DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  o public.orders;
  p public.profiles;
  max_active INTEGER := 3;
  radius_km NUMERIC := 15;
  active_count INTEGER;
  now_ts TIMESTAMPTZ := now();
BEGIN
  IF auth.role() <> 'service_role'
     AND public.current_profile_role() <> 'admin'
     AND auth.uid() IS DISTINCT FROM p_technician_id
  THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'PENDING' OR o.technician_id IS NOT NULL THEN RETURN FALSE; END IF;

  SELECT * INTO p FROM public.profiles
  WHERE id=p_technician_id
    AND role='technician'
    AND is_active=true
    AND lower(COALESCE(status,''))='active'
    AND (verification_status IS NULL OR lower(verification_status)='approved')
    AND lower(COALESCE(availability_status,'available')) IN ('available','online')
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT COALESCE(NULLIF(value,'')::INTEGER,3) INTO max_active
  FROM public.settings WHERE key='technician_max_active_jobs';
  SELECT COALESCE(NULLIF(value,'')::NUMERIC,15) INTO radius_km
  FROM public.settings WHERE key='technician_service_radius_km';

  SELECT COUNT(*) INTO active_count
  FROM public.orders
  WHERE technician_id=p_technician_id
    AND status IN ('ASSIGNED','IN_PROGRESS');

  IF active_count >= max_active THEN RETURN FALSE; END IF;

  IF p_distance_km IS NOT NULL AND p_distance_km > radius_km THEN RETURN FALSE; END IF;

  INSERT INTO public.technician_job_dispatch(
    order_id, technician_id, status, distance_km, trust_score, created_at
  ) VALUES (
    p_order_id, p_technician_id, 'OFFERED', p_distance_km, p_trust_score, now_ts
  )
  ON CONFLICT (order_id, technician_id) DO NOTHING;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE public.orders
  SET technician_id=p_technician_id,
      status='ASSIGNED',
      assigned_at=COALESCE(assigned_at,now_ts),
      last_technician_dispatch_at=now_ts,
      technician_dispatch_attempts=COALESCE(technician_dispatch_attempts,0)+1
  WHERE id=p_order_id
    AND status='PENDING'
    AND technician_id IS NULL;

  IF NOT FOUND THEN
    UPDATE public.technician_job_dispatch
      SET status='CANCELLED', responded_at=now_ts, reason='order_no_longer_pending'
    WHERE order_id=p_order_id AND technician_id=p_technician_id AND status='OFFERED';
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_technician_job(
  p_order_id UUID,
  p_technician_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_technician_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.technician_job_dispatch
  SET status='ACCEPTED', responded_at=now()
  WHERE order_id=p_order_id
    AND technician_id=p_technician_id
    AND status='OFFERED';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_technician_job(
  p_order_id UUID,
  p_technician_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_technician_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.orders
  SET status='IN_PROGRESS',
      service_started_at=now()
  WHERE id=p_order_id
    AND technician_id=p_technician_id
    AND status='ASSIGNED'
    AND EXISTS (
      SELECT 1 FROM public.technician_job_dispatch d
      WHERE d.order_id=p_order_id
        AND d.technician_id=p_technician_id
        AND d.status='ACCEPTED'
    );

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_service_otp(
  p_order_id UUID,
  p_technician_id UUID
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $
DECLARE
  o public.orders;
  code TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_technician_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO o FROM public.orders
  WHERE id=p_order_id AND technician_id=p_technician_id
  FOR UPDATE;

  IF NOT FOUND OR o.status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'JOB_NOT_IN_PROGRESS';
  END IF;

  code := lpad((floor(random()*1000000))::INTEGER::TEXT,6,'0');

  UPDATE public.orders
  SET service_otp_hash=encode(digest(code,'sha256'),'hex'),
      service_otp_created_at=now(),
      service_otp_verified=false
  WHERE id=p_order_id;

  RETURN code;
END;
$;

CREATE OR REPLACE FUNCTION public.verify_service_otp(
  p_order_id UUID,
  p_otp TEXT,
  p_technician_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE o public.orders;
BEGIN
  IF auth.role() <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_technician_id
  THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF p_otp !~ '^[0-9]{6}$' THEN RETURN FALSE; END IF;

  SELECT * INTO o FROM public.orders
  WHERE id=p_order_id AND technician_id=p_technician_id
  FOR UPDATE;

  IF NOT FOUND OR o.status <> 'IN_PROGRESS' OR o.service_otp_hash IS NULL THEN RETURN FALSE; END IF;

  IF o.service_otp_hash <> encode(digest(p_otp,'sha256'),'hex') THEN RETURN FALSE; END IF;

  UPDATE public.orders
  SET service_otp_verified=true
  WHERE id=p_order_id;

  UPDATE public.technician_job_dispatch
  SET reason=COALESCE(reason,'') || CASE WHEN COALESCE(reason,'')='' THEN '' ELSE ' | ' END || 'otp_verified'
  WHERE order_id=p_order_id AND technician_id=p_technician_id AND status='ACCEPTED';

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_technician_job_atomic(
  p_order_id UUID,
  p_technician_id UUID,
  p_payment_confirmed BOOLEAN DEFAULT FALSE,
  p_payment_reference TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  o public.orders;
  now_ts TIMESTAMPTZ := now();
BEGIN
  IF auth.role() <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_technician_id
  THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO o FROM public.orders
  WHERE id=p_order_id AND technician_id=p_technician_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
  IF o.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'INVALID_JOB_STATE'; END IF;
  IF o.service_otp_hash IS NOT NULL AND o.service_otp_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'OTP_REQUIRED';
  END IF;
  IF o.payment_status='unpaid' AND p_payment_confirmed IS NOT TRUE THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRMATION_REQUIRED';
  END IF;
  IF o.payment_method='upi' AND o.payment_status='unpaid'
     AND NULLIF(trim(p_payment_reference),'') IS NULL
  THEN RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED'; END IF;

  UPDATE public.orders
  SET status='COMPLETED',
      completed_at=now_ts,
      payment_status=CASE WHEN payment_status='unpaid' THEN 'paid' ELSE payment_status END
  WHERE id=p_order_id;

  UPDATE public.technician_job_dispatch
  SET status='COMPLETED', responded_at=now_ts
  WHERE order_id=p_order_id AND technician_id=p_technician_id AND status='ACCEPTED';

  RETURN jsonb_build_object('completed',true,'order_id',p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_assign_technician(UUID,UUID,NUMERIC,NUMERIC) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.accept_technician_job(UUID,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.start_technician_job(UUID,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_service_otp(UUID,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.verify_service_otp(UUID,TEXT,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.complete_technician_job_atomic(UUID,UUID,BOOLEAN,TEXT) TO authenticated,service_role;

COMMIT;
SELECT pg_notify('pgrst','reload schema');
