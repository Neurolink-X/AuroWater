-- Queue operational control: atomic audit trail and service-role-only activation.
-- Only the server's validated Admin API may invoke this RPC via service_role.
-- RLS on settings allows admin edits in legacy flows; a direct browser-side
-- settings update must NOT bypass release approval by enabling the queue.

CREATE OR REPLACE FUNCTION private.guard_dispatch_work_queue_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $function$
DECLARE readiness jsonb;
DECLARE jwt_role text;
BEGIN
 IF NEW.key='dispatch_work_queue_enabled' AND NEW.value='true' THEN
   IF TG_OP='UPDATE' THEN
     IF OLD.value='true' THEN RETURN NEW; END IF;
   END IF;
   jwt_role := coalesce(
     NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role',
     NULLIF(current_setting('request.jwt.claim.role',true),''),
     ''
   );
   IF jwt_role <> 'service_role' THEN
     RAISE EXCEPTION 'Dispatch queue activation must use the approved service-role admin route'
       USING ERRCODE='42501';
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

-- Toggle and immutable audit insertion succeed or fail in one transaction.
-- No API response may claim success if its audit entry cannot be inserted.
CREATE OR REPLACE FUNCTION public.set_dispatch_queue_enabled(
 p_enabled boolean, p_actor_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $function$
DECLARE old_value text;
DECLARE new_value text;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'A verified administrator identity is required'
      USING ERRCODE='23514';
  END IF;
  SELECT s.value INTO old_value
  FROM public.settings s WHERE s.key='dispatch_work_queue_enabled'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch queue migration is not installed'
      USING ERRCODE='23514';
  END IF;
  new_value := CASE WHEN p_enabled THEN 'true' ELSE 'false' END;
  IF old_value = new_value THEN RETURN p_enabled; END IF;
  UPDATE public.settings
    SET value=new_value, updated_at=clock_timestamp()
    WHERE key='dispatch_work_queue_enabled';
  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,meta)
  VALUES (
    p_actor_id,
    CASE WHEN p_enabled THEN 'dispatch_queue.enable' ELSE 'dispatch_queue.disable' END,
    'settings','dispatch_work_queue_enabled',
    jsonb_build_object('old',old_value,'new',new_value,'source','admin_dispatch_queue')
  );
  RETURN p_enabled;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_dispatch_queue_enabled(boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_dispatch_queue_enabled(boolean,uuid) TO service_role;
