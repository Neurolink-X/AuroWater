-- AuroTap durable queue for scheduled dispatch recovery.
-- SAFETY: Feature flag dispatch_work_queue_enabled defaults to OFF.
-- Orders, payouts, inventory, and current dispatch remain authoritative.
-- Every queue row contains a UUID reference and delivery metadata, not PII.
INSERT INTO public.settings(key, value)
VALUES ('dispatch_work_queue_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.dispatch_work_items (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  lane text NOT NULL CHECK (lane IN ('water', 'specialist')),
  state text NOT NULL DEFAULT 'ready'
    CHECK (state IN ('ready', 'leased', 'dead')),
  priority smallint NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 2),
  due_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 1000000),
  internal_error_streak smallint NOT NULL DEFAULT 0 CHECK (internal_error_streak BETWEEN 0 AND 8),
  last_result_code text NOT NULL DEFAULT 'queued' CHECK (length(last_result_code) <= 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispatch_work_due_idx
  ON public.dispatch_work_items(due_at, priority DESC, order_id)
  WHERE state = 'ready';
CREATE INDEX IF NOT EXISTS dispatch_work_lease_idx
  ON public.dispatch_work_items(lease_until)
  WHERE state = 'leased';
CREATE INDEX IF NOT EXISTS dispatch_work_dead_idx
  ON public.dispatch_work_items(updated_at)
  WHERE state = 'dead';

ALTER TABLE public.dispatch_work_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_work_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_work_items TO service_role;

-- Optional transactional outbox: if checkout commits, the work item commits too.
-- An unenabled queue cannot change checkout behaviour. Any failures once enabled
-- will fail the order transaction rather than silently lose a dispatch event.
CREATE OR REPLACE FUNCTION private.dispatch_work_order_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog AS $function$
DECLARE enabled boolean;
BEGIN
  -- Zero queue reads/writes when rollout is OFF: preserve legacy booking speed.
  SELECT s.value = 'true' INTO enabled
  FROM public.settings s WHERE s.key = 'dispatch_work_queue_enabled';
  IF NOT coalesce(enabled, false) THEN RETURN NEW; END IF;

  -- Only water cans use supplier dispatch. Only these five services use the
  -- technician engine. Tankers and future service types stay on their
  -- existing workflows until explicitly supported in dispatch logic.
  IF NEW.status <> 'PENDING' OR NEW.supplier_id IS NOT NULL
       OR NEW.technician_id IS NOT NULL
       OR NEW.service_type NOT IN
          ('water_can','ro_service','plumbing','borewell','motor_pump','tank_cleaning') THEN
    DELETE FROM public.dispatch_work_items WHERE order_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.dispatch_work_items AS q
    (order_id, lane, priority, due_at)
  VALUES (
    NEW.id,
    CASE WHEN NEW.service_type = 'water_can' THEN 'water' ELSE 'specialist' END,
    CASE WHEN NEW.is_emergency THEN 2 ELSE 0 END,
    clock_timestamp() + interval '20 seconds'
  )
  ON CONFLICT (order_id) DO UPDATE
    SET lane = EXCLUDED.lane,
        priority = EXCLUDED.priority,
        due_at = LEAST(q.due_at, EXCLUDED.due_at),
        updated_at = clock_timestamp()
  WHERE q.state = 'ready';
  -- Never implicitly reactivate dead letters; they require an explicit
  -- privileged action after the underlying cause has been addressed.
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.dispatch_work_order_transition()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS dispatch_work_order_transition ON public.orders;
CREATE TRIGGER dispatch_work_order_transition
  AFTER INSERT OR UPDATE OF status, supplier_id, technician_id, service_type
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.dispatch_work_order_transition();

-- Optional canary/backfill after explicitly enabling the feature. No automatic
-- production backfill or existing-order mutation is performed by this migration.
CREATE OR REPLACE FUNCTION public.enqueue_existing_pending_dispatch(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE added integer;
BEGIN
  IF (SELECT s.value FROM public.settings s
      WHERE s.key = 'dispatch_work_queue_enabled') IS DISTINCT FROM 'true'
  THEN RETURN 0; END IF;
  WITH candidates AS (
    SELECT o.id, o.service_type, o.is_emergency
    FROM public.orders o
    WHERE o.status = 'PENDING' AND o.supplier_id IS NULL
      AND o.technician_id IS NULL
      AND o.service_type IN
        ('water_can','ro_service','plumbing','borewell','motor_pump','tank_cleaning')
      AND NOT EXISTS (
        SELECT 1 FROM public.dispatch_work_items q WHERE q.order_id = o.id
      )
    ORDER BY o.created_at, o.id
    LIMIT LEAST(GREATEST(coalesce(p_limit, 1), 1), 100)
  )
  INSERT INTO public.dispatch_work_items (order_id, lane, priority, due_at)
  SELECT c.id,
         CASE WHEN c.service_type = 'water_can' THEN 'water' ELSE 'specialist' END,
         CASE WHEN c.is_emergency THEN 2 ELSE 0 END,
         clock_timestamp()
  FROM candidates c
  ON CONFLICT (order_id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN added;
END;
$function$;
REVOKE ALL ON FUNCTION public.enqueue_existing_pending_dispatch(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_existing_pending_dispatch(integer) TO service_role;

-- Atomic lease with a GLOBAL concurrency budget, enforced by an advisory
-- transaction lock only during the short claiming transaction, not while doing
-- network calls. Workers may run across different Vercel instances.
CREATE OR REPLACE FUNCTION public.claim_dispatch_work(
  p_limit integer DEFAULT 8,
  p_lease_seconds integer DEFAULT 90
)
RETURNS TABLE(order_id uuid, lane text, claim_token uuid, attempt_count integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE in_flight integer;
BEGIN
  IF (SELECT s.value FROM public.settings s
      WHERE s.key = 'dispatch_work_queue_enabled') IS DISTINCT FROM 'true'
     OR (SELECT s.value FROM public.settings s
         WHERE s.key = 'auto_assign_orders') = 'false'
  THEN RETURN; END IF;

  PERFORM pg_advisory_xact_lock(843291739::bigint);
  SELECT count(*) INTO in_flight
  FROM public.dispatch_work_items q
  WHERE q.state = 'leased' AND q.lease_until > clock_timestamp();
  IF in_flight >= 24 THEN RETURN; END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT q.order_id FROM public.dispatch_work_items q
    JOIN public.orders o ON o.id = q.order_id
    LEFT JOIN public.dispatch_retry_state r ON r.order_id = q.order_id
    WHERE ((q.state = 'ready' AND q.due_at <= clock_timestamp())
        OR (q.state = 'leased' AND q.lease_until <= clock_timestamp()))
      AND o.status = 'PENDING'
      AND o.supplier_id IS NULL AND o.technician_id IS NULL
      AND (r.next_retry_at IS NULL OR r.next_retry_at <= clock_timestamp())
    ORDER BY q.due_at, q.priority DESC, q.created_at, q.order_id
    FOR UPDATE OF q SKIP LOCKED
    LIMIT LEAST(GREATEST(coalesce(p_limit, 8), 1), 8, 24 - in_flight)
  ), leased AS (
    UPDATE public.dispatch_work_items q
    SET state = 'leased', lease_token = gen_random_uuid(),
        lease_until = clock_timestamp()
          + make_interval(secs => LEAST(GREATEST(coalesce(p_lease_seconds, 90), 60), 180)),
        attempts = LEAST(q.attempts + 1, 1000000),
        updated_at = clock_timestamp()
    FROM picked p WHERE p.order_id = q.order_id
    RETURNING q.order_id, q.lane, q.lease_token, q.attempts
  )
  SELECT l.order_id, l.lane, l.lease_token, l.attempts FROM leased l;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_dispatch_work(integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dispatch_work(integer,integer) TO service_role;

-- Only the token holder may finish a lease. Always read the canonical order
-- state; stale workers cannot duplicate an accepted assignment.
CREATE OR REPLACE FUNCTION public.finish_dispatch_work(
  p_order_id uuid, p_claim_token uuid, p_result_code text DEFAULT 'unknown'
)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE current_attempts integer; current_errors smallint; still_pending boolean; delay_seconds integer;
BEGIN
  SELECT q.attempts, q.internal_error_streak INTO current_attempts, current_errors
  FROM public.dispatch_work_items q
  WHERE q.order_id = p_order_id AND q.state = 'leased'
    AND q.lease_token = p_claim_token
  FOR UPDATE;
  IF NOT FOUND THEN
    -- Successful assignment may have already removed the queue item via the
    -- order trigger. That is a valid acknowledgement, not a worker error.
    RETURN NOT EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = p_order_id
        AND o.status = 'PENDING'
        AND o.supplier_id IS NULL AND o.technician_id IS NULL
    );
  END IF;

  SELECT (o.status = 'PENDING' AND o.supplier_id IS NULL
          AND o.technician_id IS NULL)
  INTO still_pending FROM public.orders o WHERE o.id = p_order_id;
  IF NOT coalesce(still_pending, false) THEN
    DELETE FROM public.dispatch_work_items
    WHERE order_id = p_order_id AND lease_token = p_claim_token;
    RETURN true;
  END IF;

  -- A temporary missing supplier is NEVER treated as a permanently failed
  -- booking. Persistent internal errors go to an admin-visible dead-letter state.
  IF p_result_code = 'max_attempts'
     OR (p_result_code = 'error' AND current_errors >= 7) THEN
    UPDATE public.dispatch_work_items q
    SET state = 'dead', lease_token = NULL, lease_until = NULL,
        internal_error_streak = CASE WHEN p_result_code = 'error'
          THEN LEAST(q.internal_error_streak + 1, 8) ELSE q.internal_error_streak END,
        last_result_code = CASE WHEN p_result_code = 'max_attempts'
          THEN 'assignment_attempts_exhausted' ELSE 'internal_error_exhausted' END,
        updated_at = clock_timestamp()
    WHERE q.order_id = p_order_id AND q.lease_token = p_claim_token;
    RETURN true;
  END IF;

  delay_seconds := CASE
    WHEN p_result_code = 'busy' THEN 45
    WHEN p_result_code = 'not_pending' THEN 60
    WHEN p_result_code = 'error' THEN
      LEAST(3600, 120 * power(2, LEAST(current_errors, 5)))::integer
    ELSE LEAST(3600, 120 * power(2, LEAST(current_attempts - 1, 5)))::integer
  END;
  UPDATE public.dispatch_work_items q
  SET state = 'ready', lease_token = NULL, lease_until = NULL,
      internal_error_streak = CASE WHEN p_result_code = 'error'
        THEN LEAST(q.internal_error_streak + 1, 8) ELSE 0 END,
      due_at = GREATEST(
        clock_timestamp() + make_interval(secs => delay_seconds),
        coalesce((SELECT r.next_retry_at FROM public.dispatch_retry_state r
                  WHERE r.order_id = p_order_id), clock_timestamp())
      ),
      last_result_code = left(coalesce(p_result_code, 'unknown'), 64),
      updated_at = clock_timestamp()
  WHERE q.order_id = p_order_id AND q.lease_token = p_claim_token;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.finish_dispatch_work(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_dispatch_work(uuid,uuid,text) TO service_role;

-- Resolved internal-error dead letters can only be restarted by a privileged
-- server/admin action, never by the browser or an unprivileged RPC caller.
CREATE OR REPLACE FUNCTION public.requeue_dead_dispatch_work(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE changed uuid;
BEGIN
  UPDATE public.dispatch_work_items q
  SET state = 'ready', due_at = clock_timestamp(), attempts = 0,
      internal_error_streak = 0,
      lease_until = NULL, lease_token = NULL, updated_at = clock_timestamp(),
      last_result_code = 'admin_requeued'
  WHERE q.order_id = p_order_id AND q.state = 'dead'
    AND q.last_result_code <> 'assignment_attempts_exhausted'
    AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = p_order_id
        AND o.status = 'PENDING' AND o.supplier_id IS NULL
        AND o.technician_id IS NULL
    )
  RETURNING q.order_id INTO changed;
  RETURN changed IS NOT NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.requeue_dead_dispatch_work(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_dead_dispatch_work(uuid) TO service_role;

-- Retain unresolved dead letters for human review. Clean only obsolete queue
-- metadata; never delete the canonical order, ledger, or audit history.
CREATE OR REPLACE FUNCTION private.prune_completed_dispatch_work()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE removed integer;
BEGIN
  WITH stale AS (
    SELECT q.order_id FROM public.dispatch_work_items q
    JOIN public.orders o ON o.id = q.order_id
    WHERE o.status <> 'PENDING'
      AND q.updated_at < clock_timestamp() - interval '14 days'
    ORDER BY q.updated_at LIMIT 250
  )
  DELETE FROM public.dispatch_work_items q USING stale s
  WHERE q.order_id = s.order_id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;
REVOKE ALL ON FUNCTION private.prune_completed_dispatch_work()
  FROM PUBLIC, anon, authenticated;
SELECT cron.schedule(
  'aurotap-dispatch-work-retention',
  '47 3 * * *',
  'SELECT private.prune_completed_dispatch_work()'
);

-- No extra Vercel function invoked while the queue feature is OFF or idle.
-- At most 4 worker calls every 2 minutes (32 claimed items each); normal traffic remains on the old
-- working dispatch path. Horizontal throughput must still be load-tested.
SELECT cron.schedule(
  'aurotap-dispatch-work-queue',
  '*/2 * * * *',
  $cron$
  WITH backlog AS (
    SELECT count(*) AS n FROM (
      SELECT 1 FROM public.dispatch_work_items q
      JOIN public.orders o ON o.id = q.order_id
      LEFT JOIN public.dispatch_retry_state r ON r.order_id = q.order_id
      WHERE ((q.state='ready' AND q.due_at <= now())
         OR (q.state='leased' AND q.lease_until <= now()))
        AND o.status = 'PENDING'
        AND o.supplier_id IS NULL AND o.technician_id IS NULL
        AND (r.next_retry_at IS NULL OR r.next_retry_at <= now())
      LIMIT 128
    ) bounded
  ), enabled AS (
    SELECT EXISTS (
      SELECT 1 FROM public.settings s
      WHERE s.key='dispatch_work_queue_enabled' AND s.value='true'
    ) AS yes
  )
  SELECT net.http_post(
    url := 'https://www.aurotap.in/api/internal/dispatch-work-sweep',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name='aurotap_cron_secret' LIMIT 1
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  FROM backlog b CROSS JOIN enabled e
  CROSS JOIN LATERAL generate_series(
    1, CASE WHEN e.yes THEN LEAST(4, CEIL(b.n / 32.0)::integer) ELSE 0 END
  ) batch;
  $cron$
);
