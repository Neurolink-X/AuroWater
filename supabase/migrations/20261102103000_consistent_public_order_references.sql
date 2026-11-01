-- Keep the database UUID as the internal key and issue one immutable public reference per order.
-- Existing AW-######## and AW-<32 hex> references remain valid for historical orders.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE SEQUENCE IF NOT EXISTS private.order_public_reference_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;
REVOKE ALL ON SEQUENCE private.order_public_reference_seq FROM PUBLIC, anon, authenticated;

ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_number_format_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_number_format_check
  CHECK (order_number ~* '^AW-(?:[0-9]{8}|[0-9A-Fa-f]{32}|[0-9]{8}-[0-9]{6,})$');

CREATE OR REPLACE FUNCTION private.assign_public_order_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $function$
BEGIN
  NEW.order_number :=
    'AW-' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') ||
    '-' ||
    lpad(nextval('private.order_public_reference_seq'::regclass)::text, 6, '0');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.prevent_public_order_reference_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.order_number IS DISTINCT FROM NEW.order_number THEN
    RAISE EXCEPTION 'Public order reference is immutable'
      USING ERRCODE = '22000';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.assign_public_order_reference() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_public_order_reference_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_assign_public_reference ON public.orders;
CREATE TRIGGER orders_assign_public_reference
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.assign_public_order_reference();

DROP TRIGGER IF EXISTS orders_prevent_public_reference_change ON public.orders;
CREATE TRIGGER orders_prevent_public_reference_change
  BEFORE UPDATE OF order_number ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_public_order_reference_change();

COMMIT;
