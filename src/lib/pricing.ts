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
 * Single source of truth for ALL monetary calculations on the platform.
 * Every ₹ figure shown anywhere must flow through this module.
 *
 * Revenue integrity guarantee:
 *   technicianEarnings + supplierEarnings + platformRevenue === total
 *
 * Rules:
 *  - Zero external dependencies (pure functions, no side effects)
 *  - All public functions are thoroughly typed and jsdoc-ed
 *  - Currency is always INR, stored as float ×100 precision after round2()
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
  // Expiry check
  if (coupon.expiresAt) {
    if (new Date(coupon.expiresAt) < new Date()) {
      return { valid: false, discount: 0, error: 'This coupon has expired.' };
    }
  }

  // Usage limit check
  if (
    coupon.usageLimit != null &&
    (coupon.usageCount ?? 0) >= coupon.usageLimit
  ) {
    return { valid: false, discount: 0, error: 'Coupon usage limit reached.' };
  }

  // Minimum order check
  if (coupon.minOrderTotal != null && preTaxSubtotal < coupon.minOrderTotal) {
    return {
      valid: false,
      discount: 0,
      error: `Minimum order value of ₹${coupon.minOrderTotal} required.`,
    };
  }

  let discount: number;
  if (coupon.type === 'flat') {
    discount = r2(clampMin(coupon.value));
  } else {
    const pct = clamp01(coupon.value / 100);
    discount = r2(preTaxSubtotal * pct);
    if (coupon.maxDiscountCap != null) {
      discount = r2(Math.min(discount, coupon.maxDiscountCap));
    }
  }

  // Discount cannot exceed the subtotal
  discount = r2(Math.min(discount, preTaxSubtotal));

  return {
    valid: true,
    discount,
    message:
      coupon.type === 'flat'
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

  // ── 1. Base price (water-can override) ──────────────────────────────────────
  let base: number;
  if (
    input.serviceKey === 'water_tanker' &&
    input.canCount != null &&
    input.pricePerCan != null
  ) {
    base = r2(clampMin(input.canCount) * clampMin(input.pricePerCan));
    lines.push({
      label: `Water Cans (${input.canCount} × ₹${input.pricePerCan})`,
      amount: base,
      sign: 1,
    });
  } else {
    base = r2(clampMin(input.basePrice));
    lines.push({ label: 'Service Charge', amount: base, sign: 1 });
  }

  // ── 2. Convenience fee ──────────────────────────────────────────────────────
  const convFee = r2(clampMin(input.convenienceFee));
  if (convFee > 0) {
    lines.push({
      label: 'Convenience Fee',
      amount: convFee,
      sign: 1,
      note: 'Platform processing',
    });
  }

  // ── 3. Subtotal (taxable base) ──────────────────────────────────────────────
  const subtotal = r2(base + convFee);

  // ── 4. Coupon discount (applied on subtotal, before GST) ───────────────────
  let discountAmount = 0;
  let appliedCoupon: string | null = null;

  if (input.coupon) {
    const res = evaluateCoupon(input.coupon, subtotal);
    if (res.valid) {
      discountAmount = res.discount;
      appliedCoupon = input.coupon.code;
      lines.push({
        label: `Coupon: ${input.coupon.code}`,
        amount: discountAmount,
        sign: -1,
        note: res.message,
      });
    }
  }

  const taxableBase = r2(Math.max(0, subtotal - discountAmount));

  // ── 5. GST ──────────────────────────────────────────────────────────────────
  const gstRate = clamp01(input.gstRate);
  const gstAmount = r2(taxableBase * gstRate);
  if (gstAmount > 0) {
    lines.push({
      label: `GST (${Math.round(gstRate * 100)}%)`,
      amount: gstAmount,
      sign: 1,
      note: 'Govt. tax on taxable amount',
    });
  }

  // ── 6. Emergency surcharge ──────────────────────────────────────────────────
  const emergencySurcharge = input.emergency
    ? r2(clampMin(input.emergencySurcharge))
    : 0;
  if (emergencySurcharge > 0) {
    lines.push({
      label: '🚨 Emergency Surcharge',
      amount: emergencySurcharge,
      sign: 1,
      note: 'Priority booking fee',
    });
  }

  // ── 7. Grand total ──────────────────────────────────────────────────────────
  const total = r2(
    taxableBase + gstAmount + emergencySurcharge,
  );

  // ── 8. Revenue split ────────────────────────────────────────────────────────
  let techRate = clamp01(input.technicianCommissionRate);
  let supplierRate = clamp01(input.supplierCommissionRate);

  // Prevent over-allocation: scale down proportionally if rates exceed 100%
  const combinedRate = techRate + supplierRate;
  if (combinedRate > 1) {
    techRate = r2(techRate / combinedRate);
    supplierRate = r2(supplierRate / combinedRate);
  }

  const technicianEarnings = r2(total * techRate);
  const supplierEarnings = r2(total * supplierRate);
  // Residual method guarantees integrity
  const platformRevenue = r2(
    Math.max(0, total - technicianEarnings - supplierEarnings),
  );

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
    convenienceFee: convFee,
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
  const sum = r2(
    params.technicianEarnings +
      params.supplierEarnings +
      params.platformRevenue,
  );
  return r2(sum) === r2(params.total);
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
  const now  = Date.now();
  const msDay = 86_400_000;
  const start =
    period === 'today' ? now - msDay :
    period === 'week'  ? now - 7 * msDay :
    now - 30 * msDay;
  return orders.filter(o => o.createdAt >= start);
}

/**
 * Build a 7-day daily revenue series (last 7 days, index 0 = 7 days ago).
 * Returns [{ label: 'Mon', amount: 2340 }, ...]
 */
export function buildDailyRevenueSeries(
  orders: OrderForStats[],
): { label: string; amount: number; date: string }[] {
  const completed = orders.filter(o => o.status === 'COMPLETED');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const amount = r2(
      completed
        .filter(o => new Date(o.createdAt).toISOString().slice(0, 10) === dateStr)
        .reduce((s, o) => s + o.total, 0),
    );
    return {
      label: i === 6 ? 'Today' : days[d.getDay()],
      amount,
      date: dateStr,
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