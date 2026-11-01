BEGIN;
CREATE OR REPLACE FUNCTION public.publish_pricing_version(
  p_effective_from TIMESTAMPTZ,
  p_reason TEXT,
  p_config JSONB
)
RETURNS public.pricing_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  next_version INTEGER;
  service_key TEXT;
  service_value JSONB;
  published public.pricing_versions;
BEGIN
  IF actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = actor AND role = 'admin' AND is_active = true AND COALESCE(status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_effective_from IS NOT NULL AND p_effective_from < statement_timestamp() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Effective date must be now or in the future' USING ERRCODE = '22023';
  END IF;
  p_effective_from := GREATEST(COALESCE(p_effective_from, statement_timestamp()), statement_timestamp());
  IF p_reason IS NULL OR char_length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Reason must be 3 to 500 characters' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_config) <> 'object'
    OR NOT (p_config ? 'water_normal')
    OR NOT (p_config ? 'water_chilled')
    OR NOT (p_config ? 'water_subscription')
    OR NOT (p_config ? 'bulk_can_price')
    OR NOT (p_config ? 'bulk_threshold')
    OR NOT (p_config ? 'services')
    OR NOT (p_config ? 'convenience_fee')
    OR NOT (p_config ? 'emergency_surcharge')
    OR NOT (p_config ? 'gst_rate') THEN
    RAISE EXCEPTION 'Pricing configuration is incomplete' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_config->'services') <> 'object'
    OR (p_config->>'water_normal')::numeric < 20 OR (p_config->>'water_normal')::numeric > 500
    OR (p_config->>'water_chilled')::numeric < 25 OR (p_config->>'water_chilled')::numeric > 500
    OR (p_config->>'water_subscription')::numeric < 20 OR (p_config->>'water_subscription')::numeric > 500
    OR (p_config->>'bulk_can_price')::numeric < 20
    OR (p_config->>'bulk_can_price')::numeric > (p_config->>'water_normal')::numeric
    OR (p_config->>'bulk_threshold')::integer < 2 OR (p_config->>'bulk_threshold')::integer > 200
    OR (p_config->>'convenience_fee')::numeric < 0 OR (p_config->>'convenience_fee')::numeric > 500
    OR (p_config->>'emergency_surcharge')::numeric < 0 OR (p_config->>'emergency_surcharge')::numeric > 5000
    OR (p_config->>'gst_rate')::numeric < 0 OR (p_config->>'gst_rate')::numeric > 1 THEN
    RAISE EXCEPTION 'Pricing values are outside approved limits; water prices must respect the current ₹20 single-can supplier payout rule; multi-can payout schedules remain unapproved.' USING ERRCODE = '22023';
  END IF;

  IF NOT ((p_config->'services') ?& ARRAY['water_tanker','ro_service','plumbing','plumbing_mistri','borewell','motor_pump','tank_cleaning']) THEN
    RAISE EXCEPTION 'Required service prices are missing' USING ERRCODE = '22023';
  END IF;
  FOR service_key, service_value IN
    SELECT key, value FROM jsonb_each(p_config->'services')
  LOOP
    IF service_key !~ '^[a-z][a-z0-9_]{1,49}$'
      OR jsonb_typeof(service_value) <> 'number'
      OR (service_value::text)::numeric < 0
      OR (service_key IN ('water_tanker','ro_service','plumbing','plumbing_mistri','borewell','motor_pump','tank_cleaning') AND (service_value::text)::numeric < 1)
      OR (service_value::text)::numeric > 100000 THEN
      RAISE EXCEPTION 'Invalid service base price for %', service_key USING ERRCODE = '22023';
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtext('public.pricing_versions.version'));
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM public.pricing_versions;

  INSERT INTO public.pricing_versions(version, effective_from, reason, config, created_by)
  VALUES (next_version, p_effective_from, trim(p_reason), p_config, actor)
  RETURNING * INTO published;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, meta)
  VALUES (actor, 'pricing.version.publish', 'pricing_versions', NULL,
    jsonb_build_object('version', next_version, 'effective_from', p_effective_from,
      'reason', trim(p_reason), 'config', p_config));

  RETURN published;
END;
$$;


COMMIT;
