-- Service verification codes are free in-app; harden guess attempts.
-- Existing active order codes remain valid. No order or payout mutation.
BEGIN;
CREATE TABLE IF NOT EXISTS public.service_otp_attempt_limits (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_otp_attempt_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_otp_attempt_limits FROM PUBLIC, anon, authenticated;
-- No user RLS policy by design; access is only through a verified SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.verify_service_otp(
  p_order_id uuid,
  p_otp text,
  p_technician_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  o public.orders;
  attempts_now integer;
  started_at timestamptz;
  locked_to timestamptz;
BEGIN
  IF auth.role() <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_technician_id
  THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO o FROM public.orders
  WHERE id=p_order_id AND technician_id=p_technician_id FOR UPDATE;

  IF NOT FOUND OR o.status <> 'IN_PROGRESS'
    OR o.service_otp_hash IS NULL THEN RETURN FALSE; END IF;
  IF o.service_otp_verified IS TRUE THEN RETURN TRUE; END IF;

  INSERT INTO public.service_otp_attempt_limits (order_id, attempts, window_started_at)
  VALUES (p_order_id, 0, now())
  ON CONFLICT (order_id) DO NOTHING;

  SELECT attempts, window_started_at, locked_until
    INTO attempts_now, started_at, locked_to
  FROM public.service_otp_attempt_limits
  WHERE order_id=p_order_id FOR UPDATE;

  IF locked_to IS NOT NULL AND locked_to > now() THEN RETURN FALSE; END IF;

  IF started_at < now() - interval '30 minutes' THEN
    attempts_now := 0;
    started_at := now();
  END IF;

  IF p_otp !~ '^[0-9]{6}$'
    OR o.service_otp_hash <> encode(digest(p_otp,'sha256'),'hex') THEN
    attempts_now := attempts_now + 1;
    UPDATE public.service_otp_attempt_limits
    SET attempts = attempts_now,
        window_started_at = started_at,
        locked_until = CASE WHEN attempts_now >= 5
          THEN now() + interval '30 minutes' ELSE NULL END,
        updated_at = now()
    WHERE order_id=p_order_id;
    RETURN FALSE;
  END IF;

  UPDATE public.orders SET service_otp_verified=true WHERE id=p_order_id;
  DELETE FROM public.service_otp_attempt_limits WHERE order_id=p_order_id;

  UPDATE public.technician_job_dispatch
  SET reason=coalesce(reason,'') ||
    CASE WHEN coalesce(reason,'')='' THEN '' ELSE ' | ' END || 'otp_verified'
  WHERE order_id=p_order_id AND technician_id=p_technician_id AND status='ACCEPTED';

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_service_otp(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_service_otp(uuid,text,uuid) TO authenticated, service_role;
COMMIT;
