/** Display the immutable checkout receipt; never reprice an accepted order. */
export function bookedOrderPricing(order: Record<string, unknown>) {
  const snapshot = order.pricing_snapshot && typeof order.pricing_snapshot === 'object'
    ? order.pricing_snapshot as Record<string, unknown> : {};
  const money = (...values: unknown[]): number | null => {
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  };
  const quantity = money(order.can_count, snapshot.quantity);
  const unit = money(order.can_price_per_unit, snapshot.unit_price);
  const subscription = order.can_order_type === 'subscription' || !!order.subscription_id;
  return {
    plan: subscription ? 'Subscription · booked rate' : 'One-time · booked rate',
    quantity, unit,
    option: String(order.sub_option_key ?? snapshot.option_key ?? 'Not recorded'),
    base: money(order.base_amount, snapshot.base_amount),
    gross: money(snapshot.gross_base_amount, order.base_amount, snapshot.base_amount),
    discount: (money(snapshot.loyalty_discount_amount, order.loyalty_discount_amount) ?? 0) + (money(snapshot.referral_discount_amount, order.discount_amount) ?? 0),
    convenience: money(order.convenience_fee, snapshot.convenience_fee, order.platform_fee),
    delivery: money(snapshot.delivery_fee), handling: money(snapshot.handling_fee),
    emergency: money(order.emergency_charge, snapshot.emergency_charge),
    tax: money(order.gst_amount, snapshot.gst_amount),
    total: money(order.total_amount, snapshot.total_amount, order.final_amount),
    version: money(order.pricing_version, snapshot.version),
  };
}
