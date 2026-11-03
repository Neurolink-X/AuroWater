-- AuroTap bounded retention for strictly disposable records.
-- Never delete orders, financial ledgers, profiles, audit logs, pricing, dispatch,
-- notification inbox, push subscriptions, customer addresses or PIN imports.
-- A single low-frequency worker reuses the existing pg_cron extension.
-- Successful scheduler runs older than seven days are disposable; failed runs
-- remain available for incident investigations. No VACUUM FULL/locks.
CREATE OR REPLACE FUNCTION private.prune_disposable_history()
RETURNS TABLE(cron_runs_deleted integer, expired_otps_deleted integer, stale_rate_keys_deleted integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_cron integer := 0;
  v_otp integer := 0;
  v_limits integer := 0;
BEGIN
  -- Bounded batches prevent long transactions or a sudden vacuum workload.
  WITH expired AS (
    SELECT runid FROM cron.job_run_details
    WHERE status = 'succeeded'
      AND end_time < clock_timestamp() - interval '7 days'
    ORDER BY end_time, runid
    LIMIT 2000
  )
  DELETE FROM cron.job_run_details d USING expired e WHERE d.runid = e.runid;
  GET DIAGNOSTICS v_cron = ROW_COUNT;

  -- OTPs are short-lived; allow two days beyond expiry for investigations.
  WITH expired AS (
    SELECT id FROM public.otp_requests
    WHERE expires_at < clock_timestamp() - interval '2 days'
    ORDER BY expires_at, id
    LIMIT 500
  )
  DELETE FROM public.otp_requests t USING expired e WHERE t.id = e.id;
  GET DIAGNOSTICS v_otp = ROW_COUNT;

  -- Recovery rate-limiter windows are one hour in the production consumer.
  -- Thirty days idle ensures even unusual/long windows are not pruned early.
  WITH stale AS (
    SELECT key_hash FROM public.account_recovery_rate_limits
    WHERE updated_at < clock_timestamp() - interval '30 days'
    ORDER BY updated_at, key_hash
    LIMIT 500
  )
  DELETE FROM public.account_recovery_rate_limits t USING stale e
  WHERE t.key_hash = e.key_hash;
  GET DIAGNOSTICS v_limits = ROW_COUNT;

  RETURN QUERY SELECT v_cron, v_otp, v_limits;
END;
$function$;
REVOKE ALL ON FUNCTION private.prune_disposable_history() FROM PUBLIC, anon, authenticated;
-- Existing privileged pg_cron owner is postgres. Do not expose this RPC
-- through public schema or grant it to browser roles.
SELECT cron.schedule(
  'aurotap-bounded-disposable-retention',
  '17 3 * * *',
  'SELECT * FROM private.prune_disposable_history()'
);
