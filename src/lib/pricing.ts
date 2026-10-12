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
//   const base = Math.max(0, round2(input.basePrice));
//   const convenienceFee = Math.max(0, round2(input.convenienceFee));
//   const gstRate = clamp01(input.gstRate);
//   const emergencySurcharge = input.emergency ? Math.max(0, round2(input.emergencySurcharge)) : 0;

//   const taxable = round2(base + convenienceFee);
//   const gstAmount = round2(taxable * gstRate);
//   const total = round2(base + convenienceFee + gstAmount + emergencySurcharge);

//   let techRate = clamp01(input.technicianCommissionRate);
//   let supplierRate = clamp01(input.supplierCommissionRate);
//   if (techRate + supplierRate > 1) {
//     const sum = techRate + supplierRate;
//     techRate = techRate / sum;
//     supplierRate = supplierRate / sum;
//   }

//   // Keep revenue integrity by deriving the final leg from the residual.
//   const technicianEarnings = round2(total * techRate);
//   const supplierEarnings = round2(total * supplierRate);
//   const platformRevenue = round2(total - technicianEarnings - supplierEarnings);

//   return {
//     serviceKey: input.serviceKey,
//     base,
//     convenienceFee,
//     gstRate,
//     gstAmount,
//     emergencySurcharge,
//     total,
//     technicianEarnings,
//     supplierEarnings,
//     platformRevenue: round2(Math.max(0, platformRevenue)),
//   };
// }

// export function validateRevenueIntegrity(row: PriceBreakdown): boolean {
//   const sum = round2(row.technicianEarnings + row.supplierEarnings + row.platformRevenue);
//   return round2(sum) === round2(row.total);
// }







/**
 * AuroWater — Pricing Engine  (src/lib/pricing.ts)
 *
 * Shared pure pricing/reporting utilities. Active order APIs remain the
 * authoritative pricing boundary until explicitly migrated to this module.
 *
 * Revenue integrity guarantee:
 *   technicianEarnings + supplierEarnings + platformRevenue === total
 *
 * Rules:
 *  - Zero external dependencies (pure functions, no side effects)
 *  - All public functions are thoroughly typed and jsdoc-ed
 *  - Currency values are represented as INR numbers and rounded to two decimals.
 *  - Rates are always 0..1 fractions; percentages are converted at the boundary
 */

// ─── Re-export the service key type so consumers only import from one place ──
export type ServiceKey =
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

// ─── All valid order statuses ─────────────────────────────────────────────────
export type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

// ─── Payment channel ──────────────────────────────────────────────────────────
export type PaymentMethod = 'cash' | 'online' | 'upi' | 'card';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'partial';

// ─── Discount / coupon ───────────────────────────────────────────────────────
export type DiscountType = 'flat' | 'percent';

export type Coupon = {
  /** Unique coupon code (uppercase) */
  code: string;
  type: DiscountType;
  /** Flat amount (INR) or percentage (0..100) */
  value: number;
  /** Minimum order total required to apply */
  minOrderTotal?: number;
  /** Maximum discount cap in INR (applies to percent coupons) */
  maxDiscountCap?: number;
  /** ISO date string — coupon invalid after this */
  expiresAt?: string;
  /** Null = unlimited */
  usageLimit?: number | null;
  usageCount?: number;
};

// ─── Input to the pricing engine ─────────────────────────────────────────────
export type PricingInput = {
  serviceKey: ServiceKey;
  /** Base price in INR for the chosen service/sub-option */
  basePrice: number;
  /** Platform convenience fee per order (INR) */
  convenienceFee: number;
  /** GST rate as a decimal, e.g. 0.18 for 18% */
  gstRate: number;
  /** Emergency surcharge in INR (applied only when emergency === true) */
  emergencySurcharge: number;
  emergency: boolean;
  /** Fraction of total paid to the technician (0..1) */
  technicianCommissionRate: number;
  /** Fraction of total paid to the supplier (0..1) */
  supplierCommissionRate: number;
  /** Optional coupon to apply */
  coupon?: Coupon | null;
  /** Water-can delivery: number of cans */
  canCount?: number;
  /** Price per can (INR) — used when serviceKey === 'water_tanker' */
  pricePerCan?: number;
};

// ─── Output of the pricing engine ────────────────────────────────────────────
export type PriceBreakdown = {
  serviceKey: ServiceKey;
  /** Line items (ordered for display) */
  lines: PriceLine[];
  /** Subtotal before GST and extras */
  subtotal: number;
  convenienceFee: number;
  gstRate: number;
  gstAmount: number;
  emergencySurcharge: number;
  /** Discount applied (0 when no coupon) */
  discountAmount: number;
  /** Coupon code that was applied, if any */
  appliedCoupon: string | null;
  /** Grand total charged to customer */
  total: number;
  /** Amount paid to technician */
  technicianEarnings: number;
  /** Amount paid to supplier */
  supplierEarnings: number;
  /** Platform net revenue */
  platformRevenue: number;
  /** True when revenue integrity check passes */
  valid: boolean;
};

export type PriceLine = {
  label: string;
  amount: number;
  /** Positive = charge, negative = discount */
  sign: 1 | -1;
  note?: string;
};

// ─── Utility functions (internal) ────────────────────────────────────────────

/** Round to 2 decimal places, epsilon-safe */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Clamp a value to [0, 1] */
function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

/** Clamp a value to [min, Infinity] */
function clampMin(n: number, min = 0): number {
  return Number.isFinite(n) ? Math.max(min, n) : min;
}

// ─── Coupon evaluation ───────────────────────────────────────────────────────

export type CouponResult =
  | { valid: true; discount: number; message: string }
  | { valid: false; discount: 0; error: string };

/**
 * Validate and compute the discount for a coupon against a pre-discount subtotal.
 * Does NOT modify order total — caller applies the returned discount.
 */
export function evaluateCoupon(
  coupon: Coupon,
  preTaxSubtotal: number,
): CouponResult {
  if (!Number.isFinite(preTaxSubtotal) || preTaxSubtotal < 0) {
    return { valid: false, discount: 0, error: 'Invalid order subtotal.' };
  }
  const code = typeof coupon.code === 'string' ? coupon.code.trim() : '';
  if (!code) return { valid: false, discount: 0, error: 'Invalid coupon code.' };
  if (coupon.type !== 'flat' && coupon.type !== 'percent') {
    return { valid: false, discount: 0, error: 'Invalid coupon type.' };
  }
  if (!Number.isFinite(coupon.value) || coupon.value < 0 ||
      (coupon.type === 'percent' && coupon.value > 100)) {
    return { valid: false, discount: 0, error: 'Invalid coupon value.' };
  }
  if (coupon.expiresAt) {
    const expiry = Date.parse(coupon.expiresAt);
    if (!Number.isFinite(expiry)) {
      return { valid: false, discount: 0, error: 'Invalid coupon expiry date.' };
    }
    if (expiry < Date.now()) {
      return { valid: false, discount: 0, error: 'This coupon has expired.' };
    }
  }
  if (coupon.usageLimit != null) {
    if (!Number.isSafeInteger(coupon.usageLimit) || coupon.usageLimit < 0) {
      return { valid: false, discount: 0, error: 'Invalid coupon usage limit.' };
    }
    const used = coupon.usageCount ?? 0;
    if (!Number.isSafeInteger(used) || used < 0) {
      return { valid: false, discount: 0, error: 'Invalid coupon usage count.' };
    }
    if (used >= coupon.usageLimit) {
      return { valid: false, discount: 0, error: 'Coupon usage limit reached.' };
    }
  }
  if (coupon.minOrderTotal != null) {
    if (!Number.isFinite(coupon.minOrderTotal) || coupon.minOrderTotal < 0) {
      return { valid: false, discount: 0, error: 'Invalid coupon minimum order value.' };
    }
    if (preTaxSubtotal < coupon.minOrderTotal) {
      return {
        valid: false,
        discount: 0,
        error: `Minimum order value of ₹${coupon.minOrderTotal} required.`,
      };
    }
  }
  if (coupon.maxDiscountCap != null &&
      (!Number.isFinite(coupon.maxDiscountCap) || coupon.maxDiscountCap < 0)) {
    return { valid: false, discount: 0, error: 'Invalid coupon discount cap.' };
  }
  let discount = coupon.type === 'flat'
    ? coupon.value
    : preTaxSubtotal * (coupon.value / 100);
  if (coupon.type === 'percent' && coupon.maxDiscountCap != null) {
    discount = Math.min(discount, coupon.maxDiscountCap);
  }
  discount = r2(Math.min(Math.max(0, discount), preTaxSubtotal));
  return {
    valid: true,
    discount,
    message: coupon.type === 'flat'
      ? `₹${discount} off applied`
      : `${coupon.value}% off — saved ₹${discount}`,
  };
}

// ─── Core pricing function ────────────────────────────────────────────────────

/**
 * Calculate the complete price breakdown for a water-service order.
 *
 * Revenue integrity guarantee:
 *   technicianEarnings + supplierEarnings + platformRevenue === total
 *
 * @example
 * const bd = calculateOrderTotal({
 *   serviceKey: 'water_tanker',
 *   basePrice: 350,
 *   convenienceFee: 29,
 *   gstRate: 0.18,
 *   emergencySurcharge: 199,
 *   emergency: false,
 *   technicianCommissionRate: 0.70,
 *   supplierCommissionRate: 0.10,
 * });
 * // bd.total === 449, bd.valid === true
 */
export function calculateOrderTotal(input: PricingInput): PriceBreakdown {
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
    // Invalid coupons are not applied. Server APIs must separately validate
    // coupon eligibility and increment usage atomically before saving an order.
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
  let technicianRate = assertRate(input.technicianCommissionRate, 'technicianCommissionRate');
  let supplierRate = assertRate(input.supplierCommissionRate, 'supplierCommissionRate');

  const combinedRate = technicianRate + supplierRate;
  if (combinedRate > 1) {
    technicianRate /= combinedRate;
    supplierRate /= combinedRate;
  }

  // Allocate in paise; platform receives the exact residual.
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
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return false;

  const sumPaise =
    Math.round(params.technicianEarnings * 100) +
    Math.round(params.supplierEarnings * 100) +
    Math.round(params.platformRevenue * 100);
  return sumPaise === Math.round(params.total * 100);
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
  const start = new Date();
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
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
  const dateKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const key = dateKey(day);
    const amount = r2(completed.reduce((sum, order) => {
      if (!Number.isFinite(order.createdAt) || !Number.isFinite(order.total)) return sum;
      return dateKey(new Date(order.createdAt)) === key ? sum + order.total : sum;
    }, 0));
    return {
      label: index === 6 ? 'Today' : dayLabels[day.getDay()],
      amount,
      date: key,
    };
  });
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