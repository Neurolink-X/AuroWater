-- supplier_stock insert trigger on new supplier profile
CREATE OR REPLACE FUNCTION public.init_supplier_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.role = 'supplier' THEN
    INSERT INTO public.supplier_stock (supplier_id, cans_available, low_stock_alert)
    VALUES (NEW.id, 0, 10) ON CONFLICT (supplier_id) DO NOTHING;
    INSERT INTO public.supplier_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_supplier ON public.profiles;
CREATE TRIGGER trg_init_supplier AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.init_supplier_stock();

-- RPC for atomic order count increment
CREATE OR REPLACE FUNCTION public.increment_supplier_completed_orders(p_supplier_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET completed_orders = completed_orders + 1
  WHERE id = p_supplier_id;
END;
$$;

-- Stock deduction on order completion
CREATE OR REPLACE FUNCTION public.deduct_supplier_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' AND NEW.supplier_id IS NOT NULL THEN
    UPDATE public.supplier_stock
      SET cans_available = GREATEST(0, cans_available - COALESCE(NEW.can_count, 1))
      WHERE supplier_id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_stock ON public.orders;
CREATE TRIGGER trg_deduct_stock AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.deduct_supplier_stock();

SELECT pg_notify('pgrst', 'reload schema');

