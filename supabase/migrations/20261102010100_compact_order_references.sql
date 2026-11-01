BEGIN;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_format_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_format_check
CHECK (order_number ~* '^AW-(?:[0-9]{8,19}|[0-9A-Fa-f]{32}|[0-9]{8}-[0-9]{6,})$');
CREATE OR REPLACE FUNCTION private.assign_public_order_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private
AS $$
DECLARE candidate text; sequence_value text;
BEGIN
  LOOP
    sequence_value := nextval('private.order_public_reference_seq'::regclass)::text;
    candidate := 'AW-' || CASE WHEN length(sequence_value) < 8 THEN lpad(sequence_value,8,'0') ELSE sequence_value END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = candidate);
  END LOOP;
  NEW.order_number := candidate;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.assign_public_order_reference() FROM PUBLIC, anon, authenticated;
COMMIT;
