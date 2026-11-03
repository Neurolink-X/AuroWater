-- AuroTap queue activation hardening. Base queue migration remains intact.
-- IMPORTANT: no order, payment, provider, payout or ledger record is deleted/updated.
-- Flag remains OFF. Review due dates before activating the new dispatch route.

-- Pending orders older than one day beyond their promised slot must not be
-- auto-offered to a new supplier or professional. Mark only transport metadata
-- as dead/stale_schedule_review; manual order rescheduling comes first.
CREATE OR REPLACE FUNCTION public.enqueue_existing_pending_dispatch(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE added integer;
BEGIN
  -- A privileged rollout may prefill the queue while it remains OFF.
  -- Activation is refused until eligible pending work has been backfilled.
  -- Once active, scheduled reconciliation closes any cross-transaction races.
  WITH candidates AS (
    SELECT o.id, o.service_type, o.is_emergency, o.scheduled_at
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
  INSERT INTO public.dispatch_work_items (order_id, lane, priority, due_at, state, last_result_code)
  SELECT c.id,
         CASE WHEN c.service_type = 'water_can' THEN 'water' ELSE 'specialist' END,
         CASE WHEN c.is_emergency THEN 2 ELSE 0 END,
         clock_timestamp(),
         CASE WHEN c.scheduled_at < clock_timestamp() - interval '24 hours' THEN 'dead' ELSE 'ready' END,
         CASE WHEN c.scheduled_at < clock_timestamp() - interval '24 hours' THEN 'stale_schedule_review' ELSE 'queued' END
  FROM candidates c
  ON CONFLICT (order_id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN added;
END;
$function$;
REVOKE ALL ON FUNCTION public.enqueue_existing_pending_dispatch(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_existing_pending_dispatch(integer) TO service_role;


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
      AND (o.scheduled_at IS NULL OR o.scheduled_at >= clock_timestamp() - interval '24 hours')
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
        AND (o.scheduled_at IS NULL OR o.scheduled_at >= clock_timestamp() - interval '24 hours')
    )
  RETURNING q.order_id INTO changed;
  RETURN changed IS NOT NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.requeue_dead_dispatch_work(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_dead_dispatch_work(uuid) TO service_role;


CREATE OR REPLACE FUNCTION private.quarantine_stale_dispatch_work(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $function$
DECLARE changed integer;
BEGIN
  WITH candidates AS (
    SELECT q.order_id FROM public.dispatch_work_items q
    JOIN public.orders o ON o.id=q.order_id
    WHERE q.state='ready' AND o.status='PENDING'
      AND o.supplier_id IS NULL AND o.technician_id IS NULL
      AND o.scheduled_at < clock_timestamp() - interval '24 hours'
    ORDER BY q.due_at, q.order_id
    FOR UPDATE OF q SKIP LOCKED
    LIMIT LEAST(GREATEST(coalesce(p_limit,100),1),100)
  )
  UPDATE public.dispatch_work_items q
  SET state='dead', lease_token=NULL, lease_until=NULL,
      last_result_code='stale_schedule_review',updated_at=clock_timestamp()
  FROM candidates c WHERE q.order_id=c.order_id AND q.state='ready';
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed;
END;
$function$;
REVOKE ALL ON FUNCTION private.quarantine_stale_dispatch_work(integer) FROM PUBLIC,anon,authenticated;

-- Reuse existing reconciliation cron, no additional paid HTTP scheduler.
SELECT cron.schedule('aurotap-dispatch-work-reconcile','* * * * *',
  $cron$
  SELECT public.enqueue_existing_pending_dispatch(100),
         private.quarantine_stale_dispatch_work(100)
  WHERE EXISTS(
    SELECT 1 FROM public.settings
    WHERE key='dispatch_work_queue_enabled' AND value='true'
  );
  $cron$
);

-- Service-role-only readiness: never expose the Vault secret value.
CREATE OR REPLACE FUNCTION public.dispatch_queue_release_readiness()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog AS $function$
SELECT jsonb_build_object(
 'queueCronReady',EXISTS(SELECT 1 FROM cron.job WHERE jobname='aurotap-dispatch-work-queue' AND active),
 'reconcileCronReady',EXISTS(SELECT 1 FROM cron.job WHERE jobname='aurotap-dispatch-work-reconcile' AND active),
 'secretReady',EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='aurotap_cron_secret' AND length(decrypted_secret)>10),
 'autoAssignEnabled',coalesce((SELECT value <> 'false' FROM public.settings WHERE key='auto_assign_orders'),true),
 'pendingWithoutQueue',(
   SELECT count(*) FROM public.orders o WHERE o.status='PENDING'
     AND o.supplier_id IS NULL AND o.technician_id IS NULL
     AND o.service_type IN ('water_can','ro_service','plumbing','borewell','motor_pump','tank_cleaning')
     AND NOT EXISTS(SELECT 1 FROM public.dispatch_work_items q WHERE q.order_id=o.id)
 ),
 'staleOrdersAwaitingReview',(
   SELECT count(*) FROM public.orders o WHERE o.status='PENDING'
     AND o.supplier_id IS NULL AND o.technician_id IS NULL
     AND o.service_type IN ('water_can','ro_service','plumbing','borewell','motor_pump','tank_cleaning')
     AND o.scheduled_at < clock_timestamp()-interval '24 hours'
 )
);
$function$;
REVOKE ALL ON FUNCTION public.dispatch_queue_release_readiness() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_queue_release_readiness() TO service_role;

-- Database-level rollout guard: even a direct setting change must have its
-- scheduled job, internal secret, and assignment prerequisites available.
CREATE OR REPLACE FUNCTION private.guard_dispatch_work_queue_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $function$
DECLARE readiness jsonb;
BEGIN
 IF NEW.key='dispatch_work_queue_enabled' AND NEW.value='true' THEN
   IF TG_OP='UPDATE' THEN
     IF OLD.value='true' THEN RETURN NEW; END IF;
   END IF;
   SELECT public.dispatch_queue_release_readiness() INTO readiness;
   IF NOT ((readiness->>'queueCronReady')::boolean AND
           (readiness->>'reconcileCronReady')::boolean AND
           (readiness->>'secretReady')::boolean AND
           (readiness->>'autoAssignEnabled')::boolean)
   THEN
     RAISE EXCEPTION 'Dispatch queue activation blocked: cron, secret or assignment readiness failed'
       USING ERRCODE='23514';
   END IF;
   PERFORM public.enqueue_existing_pending_dispatch(100);
   IF EXISTS (
      SELECT 1 FROM public.orders o WHERE o.status='PENDING'
        AND o.supplier_id IS NULL AND o.technician_id IS NULL
        AND o.service_type IN ('water_can','ro_service','plumbing','borewell','motor_pump','tank_cleaning')
        AND NOT EXISTS (SELECT 1 FROM public.dispatch_work_items q WHERE q.order_id=o.id)
   ) THEN
     RAISE EXCEPTION 'Backfill pending dispatch work before queue activation'
       USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_dispatch_work_queue_activation() FROM PUBLIC,anon,authenticated;
