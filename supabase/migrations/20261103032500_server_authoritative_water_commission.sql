-- New water-can orders must snapshot an admin-controlled commission rate.
-- Never trust a customer's proposed commission_rate_pct.
-- Preserve guard_orders_client_insert's existing payment/status protection.
-- Supplier payout ledger rules are deliberately unchanged.
CREATE OR REPLACE FUNCTION public.guard_orders_client_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_active_pricing jsonb;
  v_city_key text;
  v_threshold_text text;
  v_bulk_threshold integer := 50;
  v_commission_key text;
  v_commission_text text;
  v_commission_pct numeric;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.status := 'PENDING';
  NEW.supplier_id := NULL;
  NEW.technician_id := NULL;
  IF NEW.payment_status NOT IN ('pending', 'unpaid') THEN
    NEW.payment_status := 'pending';
  END IF;
  NEW.supplier_payout := 0;
  NEW.payout_status := 'pending';
  NEW.payout_paid_at := NULL;
  NEW.financials_posted_at := NULL;
  NEW.financials_payee_id := NULL;
  NEW.payment_reference := NULL;
  NEW.payment_confirmed_at := NULL;
  NEW.payment_verified_at := NULL;
  NEW.payment_verified_by := NULL;
  NEW.payment_collector := NULL;
  NEW.payment_collected_by := NULL;
  NEW.payment_collected_amount := NULL;
  NEW.payment_collected_at := NULL;

  -- Override whatever a client supplied, even if it looks valid.
  NEW.commission_rate_pct := NULL;
  IF NEW.service_type = 'water_can' THEN
    SELECT config INTO v_active_pricing
      FROM public.pricing_versions
      WHERE effective_from <= now()
      ORDER BY effective_from DESC, version DESC LIMIT 1;

    v_city_key := trim(both '-' from regexp_replace(
      lower(coalesce(NEW.address_snapshot->>'city', '')),
      '[^a-z0-9]+', '-', 'g'
    ));
    v_threshold_text := coalesce(
      v_active_pricing->'city_overrides'->v_city_key->>'bulk_threshold',
      v_active_pricing->>'bulk_threshold'
    );
    IF v_threshold_text ~ '^[0-9]{1,3}$' THEN
      v_bulk_threshold := greatest(2, least(200, v_threshold_text::integer));
    END IF;

    v_commission_key := CASE WHEN coalesce(NEW.can_count, 0) >= v_bulk_threshold
      THEN 'bulk_commission' ELSE 'supplier_commission' END;

    SELECT value INTO v_commission_text
      FROM public.settings WHERE key = v_commission_key LIMIT 1;

    IF v_commission_text ~ '^[0-9]+([.][0-9]+)? THEN
      v_commission_pct := v_commission_text::numeric;
      IF v_commission_pct BETWEEN 0 AND 50 THEN
        NEW.commission_rate_pct := v_commission_pct;
      END IF;
    END IF;
  END IF;

  NEW.otp_verified := FALSE;
  NEW.service_otp_verified := FALSE;
  NEW.accepted_at := NULL;
  NEW.completed_at := NULL;
  NEW.started_at := NULL;
  NEW.stock_reservation_status := 'none';
  NEW.stock_reserved_quantity := 0;
  NEW.stock_reserved_supplier_id := NULL;
  NEW.stock_reserved_at := NULL;
  NEW.stock_released_at := NULL;
  NEW.stock_consumed_at := NULL;
  RETURN NEW;
END;
$$;
 THEN
      v_commission_pct := v_commission_text::numeric;
      IF v_commission_pct BETWEEN 0 AND 50 THEN
        NEW.commission_rate_pct := v_commission_pct;
      END IF;
    END IF;
  END IF;

  NEW.otp_verified := FALSE;
  NEW.service_otp_verified := FALSE;
  NEW.accepted_at := NULL;
  NEW.completed_at := NULL;
  NEW.started_at := NULL;
  NEW.stock_reservation_status := 'none';
  NEW.stock_reserved_quantity := 0;
  NEW.stock_reserved_supplier_id := NULL;
  NEW.stock_reserved_at := NULL;
  NEW.stock_released_at := NULL;
  NEW.stock_consumed_at := NULL;
  RETURN NEW;
END;
$$;
