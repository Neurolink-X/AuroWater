-- Random compact public references; existing references and UUID keys are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION private.assign_public_order_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE candidate text; attempt integer;
BEGIN
  FOR attempt IN 1..100 LOOP
    candidate := 'AW-' || (10000000 + floor(random() * 90000000)::bigint)::text;
    -- Serialize inserts choosing the same candidate before checking committed orders.
    PERFORM pg_advisory_xact_lock(hashtextextended('order-reference:' || candidate, 0));
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = candidate) THEN
      NEW.order_number := candidate;
      RETURN NEW;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Unable to allocate a unique order reference; retry the request'
    USING ERRCODE = '54000';
END;
$function$;
REVOKE ALL ON FUNCTION private.assign_public_order_reference() FROM PUBLIC, anon, authenticated;
COMMIT;
