-- One-time zero-fee launch policy. Versioned, auditable and reversible by
-- publishing a NEW future version. Never rewrite historical orders/payouts.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DO $body$
DECLARE
  prior public.pricing_versions%ROWTYPE;
  next_version integer;
  next_config jsonb;
  updated_cities jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.pricing_versions.version'));
  SELECT * INTO prior FROM public.pricing_versions
  WHERE effective_from <= now() ORDER BY effective_from DESC, version DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active pricing version; abort zero-fee policy change'; END IF;

  SELECT coalesce(jsonb_object_agg(city,
    book || jsonb_build_object('convenience_fee',0,'emergency_surcharge',0,
      'delivery_fee',0,'surge_charge',0)), '{}'::jsonb)
  INTO updated_cities
  FROM jsonb_each(coalesce(prior.config->'city_overrides', '{}'::jsonb)) AS overrides(city, book);

  next_config := prior.config || jsonb_build_object(
    'convenience_fee',0,'emergency_surcharge',0,'delivery_fee',0,'surge_charge',0,
    'city_overrides',updated_cities);

  -- Re-running must not create duplicate versions.
  IF prior.config IS DISTINCT FROM next_config THEN
    SELECT coalesce(max(version),0) + 1 INTO next_version FROM public.pricing_versions;
    INSERT INTO public.pricing_versions(version,effective_from,reason,config,created_by)
    VALUES (next_version,now(),'Launch policy: zero handling, emergency, delivery and surge fees; future edits via admin',next_config,NULL);
    INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,meta)
    VALUES(NULL,'pricing.zero_fee_launch','pricing_versions',next_version::text,
      jsonb_build_object('previous_version',prior.version,'new_version',next_version,
        'fee_keys',jsonb_build_array('convenience_fee','emergency_surcharge','delivery_fee','surge_charge')));
  END IF;
END
$body$;

-- Legacy fallback paths must not resurrect old launch surcharges.
UPDATE public.settings SET value='0',updated_at=now()
WHERE key IN ('convenience_fee','emergency_surcharge','delivery_fee','surge_charge')
  AND value IS DISTINCT FROM '0';
INSERT INTO public.settings(key,value)
VALUES ('delivery_fee','0'),('surge_charge','0')
ON CONFLICT(key) DO NOTHING;
COMMIT;
