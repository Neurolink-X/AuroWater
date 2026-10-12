// import type { ServiceKey } from '@/hooks/useSettings';

// export type PricingInput = {
//   serviceKey: ServiceKey;
//   basePrice: number;
//   convenienceFee: number;
//   gstRate: number; // 0..1
//   emergencySurcharge: number;
//   emergency: boolean;
//   technicianCommissionRate: number; // 0..1
//   supplierCommissionRate: number; // 0..1
// };

// export type PriceBreakdown = {
//   serviceKey: ServiceKey;
//   base: number;
//   convenienceFee: number;
//   gstRate: number;
//   gstAmount: number;
//   emergencySurcharge: number;
//   total: number;
//   technicianEarnings: number;
//   supplierEarnings: number;
//   platformRevenue: number;
// };

// function round2(n: number): number {
//   return Math.round((n + Number.EPSILON) * 100) / 100;
// }

// function clamp01(n: number): number {
//   if (!Number.isFinite(n)) return 0;
//   return Math.max(0, Math.min(1, n));
// }

// export function calculateOrderTotal(input: PricingInput): PriceBreakdown {
  const lines: PriceLine[] = [];

  const assertMoney = (value: number, name: string): number => {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a finite, non-negative amount.`);
    }
    return r2(value);
  };
  const assertRate = (value: number, name: string): number => {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${name} must be a decimal rate between 0 and 1.`);
    }
    return value;
  };

  let base: number;
  if (input.serviceKey === 'water_tanker' &&
      input.canCount != null && input.pricePerCan != null) {
    if (!Number.isSafeInteger(input.canCount) || input.canCount <= 0) {
      throw new RangeError('canCount must be a positive whole number.');
    }
    const pricePerCan = assertMoney(input.pricePerCan, 'pricePerCan');
    base = assertMoney(input.canCount * pricePerCan, 'Water quantity total');
    lines.push({
      label: `Water Cans (${input.canCount} × ₹${pricePerCan})`,
      amount: base,
      sign: 1,
    });
  } else {
    base = assertMoney(input.basePrice, 'basePrice');
    lines.push({ label: 'Service Charge', amount: base, sign: 1 });
  }

  const convenienceFee = assertMoney(input.convenienceFee, 'convenienceFee');
  if (convenienceFee > 0) {
    lines.push({
      label: 'Convenience Fee',
      amount: convenienceFee,
      sign: 1,
      note: 'Platform processing',
    });
  }

  const subtotal = r2(base + convenienceFee);
  let discountAmount = 0;
  let appliedCoupon: string | null = null;

  if (input.coupon) {
    const result = evaluateCoupon(input.coupon, subtotal);
    if (result.valid) {
      discountAmount = result.discount;
      appliedCoupon = input.coupon.code.trim();
      lines.push({
        label: `Coupon: ${appliedCoupon}`,
        amount: discountAmount,
        sign: -1,
        note: result.message,
      });
    }
    // Invalid coupons are not applied. The API must independently validate
    // coupon eligibility and usage atomically before persisting an order.
  }

  const taxableBase = r2(Math.max(0, subtotal - discountAmount));
  const gstRate = assertRate(input.gstRate, 'gstRate');
  const gstAmount = r2(taxableBase * gstRate);

  if (gstAmount > 0) {
    lines.push({
      label: `GST (${Math.round(gstRate * 100)}%)`,
      amount: gstAmount,
      sign: 1,
      note: 'Tax on taxable amount; confirm configured tax treatment.',
    });
  }

  const emergencySurcharge = input.emergency
    ? assertMoney(input.emergencySurcharge, 'emergencySurcharge')
    : 0;
  if (emergencySurcharge > 0) {
    lines.push({
      label: 'Emergency Surcharge',
      amount: emergencySurcharge,
      sign: 1,
      note: 'Priority booking fee',
    });
  }

  const total = r2(taxableBase + gstAmount + emergencySurcharge);

  // Validate rates rather than silently clamping invalid configuration to zero.
  let technicianRate = assertRate(input.technicianCommissionRate, 'technicianCommissionRate');
  let supplierRate = assertRate(input.supplierCommissionRate, 'supplierCommissionRate');

  // Normalize only if configured payout rates exceed the full amount.
  const combinedRate = technicianRate + supplierRate;
  if (combinedRate > 1) {
    technicianRate /= combinedRate;
    supplierRate /= combinedRate;
  }

  // Allocate in paise, then assign the exact residual to the platform.
  // This prevents floating-point drift and ensures the three legs sum to total.
  const totalPaise = Math.round(total * 100);
  const technicianPaise = Math.min(totalPaise, Math.round(totalPaise * technicianRate));
  const supplierPaise = Math.min(
    totalPaise - technicianPaise,
    Math.round(totalPaise * supplierRate),
  );
  const platformPaise = totalPaise - technicianPaise - supplierPaise;

  const technicianEarnings = technicianPaise / 100;
  const supplierEarnings = supplierPaise / 100;
  const platformRevenue = platformPaise / 100;

  const valid = validateRevenueIntegrity({
    technicianEarnings,
    supplierEarnings,
    platformRevenue,
    total,
  });

  return {
    serviceKey: input.serviceKey,
    lines,
    subtotal,
    convenienceFee,
    gstRate,
    gstAmount,
    emergencySurcharge,
    discountAmount,
    appliedCoupon,
    total,
    technicianEarnings,
    supplierEarnings,
    platformRevenue,
    valid,
  };
}

// ─── Revenue integrity validator ─────────────────────────────────────────────

/**
 * Verify that the three revenue legs sum to the order total.
 * Call this before persisting any order to storage / DB.
 */
export function validateRevenueIntegrity(params: {
  technicianEarnings: number;
  supplierEarnings: number;
  platformRevenue: number;
  total: number;
}): boolean {
  const values = [
    params.technicianEarnings,
    params.supplierEarnings,
    params.platformRevenue,
    params.total,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return false;
  }

  const sumPaise =
    Math.round(params.technicianEarnings * 100) +
    Math.round(params.supplierEarnings * 100) +
    Math.round(params.platformRevenue * 100);
  const totalPaise = Math.round(params.total * 100);

  return sumPaise === totalPaise;
}

// ─── Formatting helpers (UI layer) ───────────────────────────────────────────

/** Format a number as Indian Rupees: ₹1,29,999 */
export function formatINR(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/** Format INR with paise: ₹1,299.50 */
export function formatINRWithPaise(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return (
    '₹' +
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** Format a rate as percentage string: 0.18 → "18%" */
export function formatRate(rate: number): string {
  return `${Math.round(clamp01(rate) * 100)}%`;
}

/** Format a compact amount: 1299 → "₹1.3K", 150000 → "₹1.5L" */
export function formatINRCompact(amount: number): string {
  const n = Number.isFinite(amount) ? Math.abs(amount) : 0;
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)  return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
  return formatINR(amount);
}

// ─── Batch / reporting helpers ────────────────────────────────────────────────

export type OrderForStats = {
  status: OrderStatus;
  total: number;
  technicianEarnings: number;
  supplierEarnings: number;
  platformRevenue: number;
  createdAt: number; // epoch ms
  serviceKey: ServiceKey;
};

export type RevenueStats = {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  activeOrders: number;
  grossRevenue: number;           // sum of completed order totals
  technicianPayouts: number;
  supplierPayouts: number;
  platformNetRevenue: number;
  averageOrderValue: number;
  completionRate: number;         // 0..1
  byService: Record<ServiceKey, { count: number; revenue: number }>;
};

/**
 * Aggregate revenue stats from a list of orders.
 * Filters to only completed orders for monetary figures.
 */
export function computeRevenueStats(orders: OrderForStats[]): RevenueStats {
  const completed = orders.filter(o => o.status === 'COMPLETED');
  const cancelled = orders.filter(o => o.status === 'CANCELLED');
  const active    = orders.filter(
    o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED',
  );

  const grossRevenue       = r2(completed.reduce((s, o) => s + o.total, 0));
  const technicianPayouts  = r2(completed.reduce((s, o) => s + o.technicianEarnings, 0));
  const supplierPayouts    = r2(completed.reduce((s, o) => s + o.supplierEarnings, 0));
  const platformNetRevenue = r2(completed.reduce((s, o) => s + o.platformRevenue, 0));

  const byService = {} as Record<ServiceKey, { count: number; revenue: number }>;
  const keys: ServiceKey[] = [
    'water_tanker','ro_service','plumbing','borewell','motor_pump','tank_cleaning',
  ];
  for (const k of keys) byService[k] = { count: 0, revenue: 0 };
  for (const o of completed) {
    byService[o.serviceKey].count   += 1;
    byService[o.serviceKey].revenue  = r2(byService[o.serviceKey].revenue + o.total);
  }

  return {
    totalOrders:      orders.length,
    completedOrders:  completed.length,
    cancelledOrders:  cancelled.length,
    activeOrders:     active.length,
    grossRevenue,
    technicianPayouts,
    supplierPayouts,
    platformNetRevenue,
    averageOrderValue: completed.length > 0 ? r2(grossRevenue / completed.length) : 0,
    completionRate:   orders.length > 0 ? r2(completed.length / orders.length) : 0,
    byService,
  };
}

/**
 * Filter orders to a time window.
 */
export function filterByPeriod(
  orders: OrderForStats[],
  period: 'today' | 'week' | 'month' | 'all',
): OrderForStats[] {
  if (period === 'all') return orders;

  const now = new Date();
  const start = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setHours(0, 0, 0, 0);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  const startMs = start.getTime();
  return orders.filter((order) =>
    Number.isFinite(order.createdAt) && order.createdAt >= startMs
  );
}

/**
 * Build a 7-day daily revenue series (last 7 days, index 0 = 7 days ago).
 * Returns [{ label: 'Mon', amount: 2340 }, ...]
 */
export function buildDailyRevenueSeries(
  orders: OrderForStats[],
): { label: string; amount: number; date: string }[] {
  const completed = orders.filter((order) => order.status === 'COMPLETED');
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const localDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const series: { label: string; amount: number; date: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const date = localDateKey(day);

    const amount = r2(completed.reduce((sum, order) => {
      if (!Number.isFinite(order.createdAt) || !Number.isFinite(order.total)) {
        return sum;
      }
      return localDateKey(new Date(order.createdAt)) === date
        ? sum + order.total
        : sum;
    }, 0));

    series.push({
      label: offset === 0 ? 'Today' : dayLabels[day.getDay()],
      amount,
      date,
    });
  }

  return series;
}

// ─── Savings helper (for customer dashboard) ─────────────────────────────────

/**
 * Compute total customer savings from all applied coupons.
 * Requires orders enriched with discountAmount field.
 */
export function computeCustomerSavings(
  orders: (OrderForStats & { discountAmount?: number })[],
): number {
  return r2(
    orders
      .filter(o => o.status === 'COMPLETED')
      .reduce((s, o) => s + (o.discountAmount ?? 0), 0),
  );
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isServiceKey(key: string): key is ServiceKey {
  return [
    'water_tanker','ro_service','plumbing',
    'borewell','motor_pump','tank_cleaning',
  ].includes(key);
}

export function isCompletedOrder(
  o: OrderForStats,
): o is OrderForStats & { status: 'COMPLETED' } {
  return o.status === 'COMPLETED';
}

// ─── Constants (UI helpers) ───────────────────────────────────────────────────

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  water_tanker:  'Water Tanker',
  ro_service:    'RO Service',
  plumbing:      'Plumbing',
  borewell:      'Borewell',
  motor_pump:    'Motor & Pump',
  tank_cleaning: 'Tank Cleaning',
};

export const SERVICE_EMOJI: Record<ServiceKey, string> = {
  water_tanker:  '🚛',
  ro_service:    '💧',
  plumbing:      '🔧',
  borewell:      '⛏️',
  motor_pump:    '⚙️',
  tank_cleaning: '🪣',
};

export const ALL_SERVICE_KEYS: ServiceKey[] = [
  'water_tanker','ro_service','plumbing','borewell','motor_pump','tank_cleaning',
];