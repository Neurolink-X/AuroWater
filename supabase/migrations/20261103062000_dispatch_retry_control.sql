-- AuroTap: operational retry metadata only; order state, payments and ledgers remain untouched.
CREATE TABLE IF NOT EXISTS public.dispatch_retry_state (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  failures integer NOT NULL DEFAULT 0 CHECK (failures BETWEEN 0 AND 30),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'none' CHECK (char_length(reason) <= 64),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispatch_retry_due_idx ON public.dispatch_retry_state(next_retry_at);
ALTER TABLE public.dispatch_retry_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_retry_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_retry_state TO service_role;

-- Only service-role callers may claim; concurrent schedulers cannot take the same lease.
CREATE OR REPLACE FUNCTION public.claim_dispatch_retry(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $function$
DECLARE claimed uuid;
BEGIN
  IF p_order_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id=p_order_id AND status='PENDING'
  ) THEN RETURN false; END IF;
  INSERT INTO public.dispatch_retry_state AS s (order_id,next_retry_at,updated_at)
  VALUES(p_order_id,clock_timestamp()+interval '2 minutes',clock_timestamp())
  ON CONFLICT(order_id) DO UPDATE
  SET next_retry_at=EXCLUDED.next_retry_at, updated_at=clock_timestamp()
  WHERE s.next_retry_at <= clock_timestamp()
  RETURNING order_id INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_dispatch_retry(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dispatch_retry(uuid) TO service_role;

-- No eligible suppliers is a scheduled retry failure, NOT a stock/assignment attempt.
CREATE OR REPLACE FUNCTION public.record_dispatch_failure(
  p_order_id uuid,p_reason text DEFAULT 'no_candidates'
)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $function$
DECLARE touched uuid;
BEGIN
  IF p_order_id IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text,321));
  UPDATE public.orders SET last_dispatch_at=clock_timestamp()
  WHERE id=p_order_id AND status='PENDING' RETURNING id INTO touched;
  IF touched IS NULL THEN RETURN false; END IF;
  INSERT INTO public.dispatch_retry_state AS s
    (order_id,failures,next_retry_at,reason,updated_at)
  VALUES (p_order_id,1,clock_timestamp()+interval '2 minutes',
    left(coalesce(p_reason,'unknown'),64),clock_timestamp())
  ON CONFLICT(order_id) DO UPDATE
    SET failures=LEAST(s.failures+1,30),
        next_retry_at=clock_timestamp()+
          (LEAST(3600,120*power(2,LEAST(s.failures,5)))::integer * interval '1 second'),
        reason=EXCLUDED.reason,updated_at=clock_timestamp();
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_dispatch_failure(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_dispatch_failure(uuid,text) TO service_role;

-- Bounded retention: only metadata for finished/cancelled orders, never order records.
CREATE OR REPLACE FUNCTION private.prune_dispatch_retry_state()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $function$
DECLARE removed integer;
BEGIN
  WITH old_rows AS (
    SELECT r.order_id FROM public.dispatch_retry_state r
    JOIN public.orders o ON o.id=r.order_id
    WHERE o.status IN ('COMPLETED','CANCELLED')
      AND r.updated_at < now()-interval '14 days'
    ORDER BY r.updated_at LIMIT 250
  )
  DELETE FROM public.dispatch_retry_state d USING old_rows r
  WHERE d.order_id=r.order_id;
  GET DIAGNOSTICS removed=ROW_COUNT;
  RETURN removed;
END;
$function$;
REVOKE ALL ON FUNCTION private.prune_dispatch_retry_state() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('aurotap-dispatch-retry-retention','41 3 * * *',
  'SELECT private.prune_dispatch_retry_state()');
