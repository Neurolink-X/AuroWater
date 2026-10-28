/**
 * AuroWater — Pricing Engine  (src/lib/pricing.ts)
 * Single source of truth for ALL monetary calculations.
 *
 * Revenue integrity:  technician + supplier + platform + gstPayable === total
 * (gstPayable is 0 unless commissionBasis === 'preTax', so old behaviour is unchanged.)
 *
 * v2 is backward compatible: every previous export keeps its name and signature.
 * New: CAN_PRICES, VOLUME_PLANS, planForQty, monthlyCanCount, commissionBasis.
 */

export type ServiceKey = 'water_tanker' | 'ro_service' | 'plumbing' | 'borewell' | 'motor_pump' | 'tank_cleaning';
export type OrderStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'cash' | 'online' | 'upi' | 'card';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'partial';
export type DiscountType = 'flat' | 'percent';

/* ─── Public can prices + monthly plans (homepage, checkout and visualizer all read these) ─── */
export const CAN_PRICES = { normal: 20, chilled: 25, litres: 20 } as const;

/** ⚠️ Proposed discounts: confirm against margins. */
export const VOLUME_PLANS = [
  { id: 'payg',   name: 'Pay as you go', minCans: 1,  off: 0,  note: 'No commitment' },
  { id: 'saver',  name: 'Home Saver',    minCans: 12, off: 5,  note: '12+ cans / month' },
  { id: 'family', name: 'Family Plan',   minCans: 30, off: 8,  note: '30+ cans / month' },
  { id: 'bulk',   name: 'Office & Bulk', minCans: 60, off: 12, note: '60+ cans / month' },
] as const;
export type VolumePlan = (typeof VOLUME_PLANS)[number];

export function planForQty(cansPerMonth: number): VolumePlan {
  const q = Number.isFinite(cansPerMonth) ? cansPerMonth : 0;
  return [...VOLUME_PLANS].reverse().find(p => q >= p.minCans) ?? VOLUME_PLANS[0];
}

/* ─── Types ─── */
export type Coupon = {
  code: string;
  type: DiscountType;
  /** Flat amount (INR) or percentage (0..100) */
  value: number;
  minOrderTotal?: number;
  /** Cap in INR for percent coupons */
  maxDiscountCap?: number;
  expiresAt?: string;
  usageLimit?: number | null;
  usageCount?: number;
};

export type PricingInput = {
  serviceKey: ServiceKey;
  basePrice: number;
  convenienceFee: number;
  /** 0..1, e.g. 0.18 */
  gstRate: number;
  emergencySurcharge: number;
  emergency: boolean;
  technicianCommissionRate: number; // 0..1
  supplierCommissionRate: number;   // 0..1
  coupon?: Coupon | null;
  /** Water cans in this order (serviceKey === 'water_tanker') */
  canCount?: number;
  pricePerCan?: number;
  /** NEW: customer's monthly can volume; applies the matching VOLUME_PLANS discount to the can charge */
  monthlyCanCount?: number;
  /** Explicit water type keeps normal/chilled minimums unambiguous for pricing floors. */
  waterType?: 'normal' | 'chilled';
  /**
   * NEW: what the commission split is calculated on.
   * 'total'  (default, old behaviour): split the full amount including GST.
   * 'preTax': split the amount excluding GST; GST is reported as gstPayable, not platform revenue.
   */
  commissionBasis?: 'total' | 'preTax';
};

export type PriceLine = { label: string; amount: number; sign: 1 | -1; note?: string };

export type PriceBreakdown = {
  serviceKey: ServiceKey;
  lines: PriceLine[];
  subtotal: number;
  convenienceFee: number;
  gstRate: number;
  gstAmount: number;
  emergencySurcharge: number;
  discountAmount: number;
  appliedCoupon: string | null;
  total: number;
  technicianEarnings: number;
  supplierEarnings: number;
  platformRevenue: number;
  valid: boolean;
  /** NEW (optional so old consumers/literals still compile) */
  volumeDiscount?: number;
  appliedPlan?: string | null;
  gstPayable?: number;
};

/* ─── Internal helpers ─── */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const clampMin = (n: number, min = 0) => (Number.isFinite(n) ? Math.max(min, n) : min);

/* ─── Coupons ─── */
export type CouponResult =
  | { valid: true; discount: number; message: string }
  | { valid: false; discount: 0; error: string };

export function evaluateCoupon(coupon: Coupon, preTaxSubtotal: number): CouponResult {
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date())
    return { valid: false, discount: 0, error: 'This coupon has expired.' };
  if (coupon.usageLimit != null && (coupon.usageCount ?? 0) >= coupon.usageLimit)
    return { valid: false, discount: 0, error: 'Coupon usage limit reached.' };
  if (coupon.minOrderTotal != null && preTaxSubtotal < coupon.minOrderTotal)
    return { valid: false, discount: 0, error: `Minimum order value of ₹${coupon.minOrderTotal} required.` };

  let discount: number;
  if (coupon.type === 'flat') discount = r2(clampMin(coupon.value));
  else {
    discount = r2(preTaxSubtotal * clamp01(coupon.value / 100));
    if (coupon.maxDiscountCap != null) discount = r2(Math.min(discount, coupon.maxDiscountCap));
  }
  discount = r2(Math.min(discount, preTaxSubtotal));
  return {
    valid: true, discount,
    message: coupon.type === 'flat' ? `₹${discount} off applied` : `${coupon.value}% off — saved ₹${discount}`,
  };
}

/* ─── Core ─── */
/**
 * @example
 * calculateOrderTotal({ serviceKey:'water_tanker', basePrice:350, convenienceFee:29, gstRate:0.18,
 *   emergencySurcharge:199, emergency:false, technicianCommissionRate:0.7, supplierCommissionRate:0.1 })
 * // total = (350 + 29) × 1.18 = 447.22
 */
export function calculateOrderTotal(input: PricingInput): PriceBreakdown {
  const lines: PriceLine[] = [];
  const waterCanCount = input.canCount == null ? null : Math.max(1, Math.floor(clampMin(input.canCount)));

  // 1. Base (can override)
  let base: number;
  if (input.serviceKey === 'water_tanker' && waterCanCount != null && input.pricePerCan != null) {
    const waterType = input.waterType ?? (input.pricePerCan === CAN_PRICES.chilled ? 'chilled' : 'normal');
    const minimumUnitPrice = waterType === 'chilled' ? CAN_PRICES.chilled : CAN_PRICES.normal;
    const safeUnitPrice = Math.max(clampMin(input.pricePerCan), minimumUnitPrice);
    base = r2(waterCanCount * safeUnitPrice);
    lines.push({ label: `Water Cans (${waterCanCount} × ₹${safeUnitPrice})`, amount: base, sign: 1 });
  } else {
    base = r2(clampMin(input.basePrice));
    lines.push({ label: 'Service Charge', amount: base, sign: 1 });
  }

  // 1b. Monthly volume plan (cans only)
  let volumeDiscount = 0;
  let appliedPlan: string | null = null;
  if (input.serviceKey === 'water_tanker' && input.monthlyCanCount != null) {
    const plan = planForQty(input.monthlyCanCount);
    if (plan.off > 0) {
      const hasUnitPrice = waterCanCount != null && input.pricePerCan != null;
      // Existing callers that do not identify the can type remain compatible.
      const waterType = input.waterType ?? (input.pricePerCan === CAN_PRICES.chilled ? 'chilled' : 'normal');
      const minimumUnitPrice = waterType === 'chilled' ? CAN_PRICES.chilled : CAN_PRICES.normal;
      const minimumCanSubtotal = hasUnitPrice
        ? r2(waterCanCount! * minimumUnitPrice)
        : 0;
      const maximumSafeDiscount = hasUnitPrice ? Math.max(0, base - minimumCanSubtotal) : base;
      volumeDiscount = r2(Math.min(base * (plan.off / 100), maximumSafeDiscount));
      if (volumeDiscount > 0) {
        appliedPlan = plan.name;
        lines.push({ label: `${plan.name} plan (${plan.off}% off)`, amount: volumeDiscount, sign: -1, note: plan.note });
      }
    }
  }
  const baseAfterPlan = r2(base - volumeDiscount);

  // 2. Convenience fee
  const convFee = r2(clampMin(input.convenienceFee));
  if (convFee > 0) lines.push({ label: 'Convenience Fee', amount: convFee, sign: 1, note: 'Platform processing' });

  // 3. Subtotal
  const subtotal = r2(baseAfterPlan + convFee);

  // 4. Coupon (on subtotal, before GST)
  let discountAmount = 0;
  let appliedCoupon: string | null = null;
  if (input.coupon) {
    const res = evaluateCoupon(input.coupon, subtotal);
    if (res.valid) {
      discountAmount = res.discount;
      // Coupons may reduce fees, but never water-can charges below approved floors.
      if (input.serviceKey === 'water_tanker' && waterCanCount != null && input.pricePerCan != null) {
        const waterType = input.waterType ?? (input.pricePerCan === CAN_PRICES.chilled ? 'chilled' : 'normal');
        const minimumUnitPrice = waterType === 'chilled' ? CAN_PRICES.chilled : CAN_PRICES.normal;
        const minimumCanSubtotal = r2(waterCanCount * minimumUnitPrice);
        discountAmount = r2(Math.min(discountAmount, Math.max(0, subtotal - minimumCanSubtotal)));
      }
      if (discountAmount > 0) {
        appliedCoupon = input.coupon.code;
        lines.push({ label: `Coupon: ${input.coupon.code}`, amount: discountAmount, sign: -1, note: res.message });
      }
    }
  }
  const taxableBase = r2(Math.max(0, subtotal - discountAmount));

  // 5. GST
  const gstRate = clamp01(input.gstRate);
  const gstAmount = r2(taxableBase * gstRate);
  if (gstAmount > 0)
    lines.push({ label: `GST (${Math.round(gstRate * 100)}%)`, amount: gstAmount, sign: 1, note: 'Govt. tax on taxable amount' });

  // 6. Emergency
  const emergencySurcharge = input.emergency ? r2(clampMin(input.emergencySurcharge)) : 0;
  if (emergencySurcharge > 0)
    lines.push({ label: '🚨 Emergency Surcharge', amount: emergencySurcharge, sign: 1, note: 'Priority booking fee' });

  // 7. Total
  const total = r2(taxableBase + gstAmount + emergencySurcharge);

  // 8. Split
  let techRate = clamp01(input.technicianCommissionRate);
  let supplierRate = clamp01(input.supplierCommissionRate);
  const combined = techRate + supplierRate;
  if (combined > 1) { techRate /= combined; supplierRate /= combined; } // v1 rounded these to 2dp (precision loss)

  const preTax = input.commissionBasis === 'preTax';
  const gstPayable = preTax ? gstAmount : 0;
  const splitBase = r2(total - gstPayable);
  const technicianEarnings = r2(splitBase * techRate);
  let supplierEarnings = r2(splitBase * supplierRate);
  if (technicianEarnings + supplierEarnings > splitBase) supplierEarnings = r2(splitBase - technicianEarnings); // rounding guard
  const platformRevenue = r2(Math.max(0, splitBase - technicianEarnings - supplierEarnings));

  const valid = validateRevenueIntegrity({ technicianEarnings, supplierEarnings, platformRevenue, total, gstPayable });

  return {
    serviceKey: input.serviceKey, lines, subtotal, convenienceFee: convFee, gstRate, gstAmount,
    emergencySurcharge, discountAmount, appliedCoupon, total,
    technicianEarnings, supplierEarnings, platformRevenue, valid,
    volumeDiscount, appliedPlan, gstPayable,
  };
}

/** Revenue legs (+ GST held for remittance) must sum to the total. Call before persisting an order. */
export function validateRevenueIntegrity(p: {
  technicianEarnings: number; supplierEarnings: number; platformRevenue: number; total: number; gstPayable?: number;
}): boolean {
  const sum = p.technicianEarnings + p.supplierEarnings + p.platformRevenue + (p.gstPayable ?? 0);
  return Math.abs(sum - p.total) < 0.005;
}

/* ─── Formatting ─── */
export function formatINR(amount: number): string {
  return '₹' + Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN');
}
export function formatINRWithPaise(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function formatRate(rate: number): string { return `${Math.round(clamp01(rate) * 100)}%`; }
export function formatINRCompact(amount: number): string {
  const n = Number.isFinite(amount) ? Math.abs(amount) : 0;
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return formatINR(amount);
}

/* ─── Reporting ─── */
export type OrderForStats = {
  status: OrderStatus; total: number; technicianEarnings: number; supplierEarnings: number;
  platformRevenue: number; createdAt: number; serviceKey: ServiceKey;
};
export type RevenueStats = {
  totalOrders: number; completedOrders: number; cancelledOrders: number; activeOrders: number;
  grossRevenue: number; technicianPayouts: number; supplierPayouts: number; platformNetRevenue: number;
  averageOrderValue: number; completionRate: number;
  byService: Record<ServiceKey, { count: number; revenue: number }>;
};

export const ALL_SERVICE_KEYS: ServiceKey[] = ['water_tanker', 'ro_service', 'plumbing', 'borewell', 'motor_pump', 'tank_cleaning'];

export function computeRevenueStats(orders: OrderForStats[]): RevenueStats {
  const completed = orders.filter(o => o.status === 'COMPLETED');
  const cancelled = orders.filter(o => o.status === 'CANCELLED');
  const sum = (f: (o: OrderForStats) => number) => r2(completed.reduce((s, o) => s + f(o), 0));
  const grossRevenue = sum(o => o.total);

  const byService = {} as Record<ServiceKey, { count: number; revenue: number }>;
  for (const k of ALL_SERVICE_KEYS) byService[k] = { count: 0, revenue: 0 };
  for (const o of completed) {
    const row = byService[o.serviceKey];
    if (!row) continue; // unknown key from old data: skip instead of crashing
    row.count += 1;
    row.revenue = r2(row.revenue + o.total);
  }
  return {
    totalOrders: orders.length, completedOrders: completed.length, cancelledOrders: cancelled.length,
    activeOrders: orders.length - completed.length - cancelled.length,
    grossRevenue, technicianPayouts: sum(o => o.technicianEarnings), supplierPayouts: sum(o => o.supplierEarnings),
    platformNetRevenue: sum(o => o.platformRevenue),
    averageOrderValue: completed.length ? r2(grossRevenue / completed.length) : 0,
    completionRate: orders.length ? Math.round((completed.length / orders.length) * 10000) / 10000 : 0,
    byService,
  };
}

export function filterByPeriod(orders: OrderForStats[], period: 'today' | 'week' | 'month' | 'all'): OrderForStats[] {
  if (period === 'all') return orders;
  const day = 86_400_000;
  const start = Date.now() - (period === 'today' ? day : period === 'week' ? 7 * day : 30 * day);
  return orders.filter(o => o.createdAt >= start);
}

/** Local-time YYYY-MM-DD (v1 used UTC, which put IST orders before 5:30am on the wrong day) */
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function buildDailyRevenueSeries(orders: OrderForStats[]): { label: string; amount: number; date: string }[] {
  const completed = orders.filter(o => o.status === 'COMPLETED');
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = localKey(d);
    const amount = r2(completed.filter(o => localKey(new Date(o.createdAt)) === key).reduce((s, o) => s + o.total, 0));
    return { label: i === 6 ? 'Today' : names[d.getDay()], amount, date: key };
  });
}

export function computeCustomerSavings(orders: (OrderForStats & { discountAmount?: number; volumeDiscount?: number })[]): number {
  return r2(orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + (o.discountAmount ?? 0) + (o.volumeDiscount ?? 0), 0));
}

/* ─── Guards + UI constants ─── */
export function isServiceKey(key: string): key is ServiceKey { return (ALL_SERVICE_KEYS as string[]).includes(key); }
export function isCompletedOrder(o: OrderForStats): o is OrderForStats & { status: 'COMPLETED' } { return o.status === 'COMPLETED'; }

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  water_tanker: 'Water Tanker', ro_service: 'RO Service', plumbing: 'Plumbing',
  borewell: 'Borewell', motor_pump: 'Motor & Pump', tank_cleaning: 'Tank Cleaning',
};
export const SERVICE_EMOJI: Record<ServiceKey, string> = {
  water_tanker: '🚛', ro_service: '💧', plumbing: '🔧', borewell: '⛏️', motor_pump: '⚙️', tank_cleaning: '🪣',
};







// /**
//  * AuroWater — Pricing Engine  (src/lib/pricing.ts)
//  *
//  * Single source of truth for ALL monetary calculations on the platform.
//  * Every ₹ figure shown anywhere must flow through this module.
//  *
//  * Revenue integrity guarantee:
//  *   technicianEarnings + supplierEarnings + platformRevenue === total
//  *
//  * Rules:
//  *  - Zero external dependencies (pure functions, no side effects)
//  *  - All public functions are thoroughly typed and jsdoc-ed
//  *  - Currency is always INR, stored as float ×100 precision after round2()
//  *  - Rates are always 0..1 fractions; percentages are converted at the boundary
//  */

// // ─── Re-export the service key type so consumers only import from one place ──
// export type ServiceKey =
//   | 'water_tanker'
//   | 'ro_service'
//   | 'plumbing'
//   | 'borewell'
//   | 'motor_pump'
//   | 'tank_cleaning';

// // ─── All valid order statuses ─────────────────────────────────────────────────
// export type OrderStatus =
//   | 'PENDING'
//   | 'ASSIGNED'
//   | 'IN_PROGRESS'
//   | 'COMPLETED'
//   | 'CANCELLED';

// // ─── Payment channel ──────────────────────────────────────────────────────────
// export type PaymentMethod = 'cash' | 'online' | 'upi' | 'card';
// export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'partial';

// // ─── Discount / coupon ───────────────────────────────────────────────────────
// export type DiscountType = 'flat' | 'percent';

// export type Coupon = {
//   /** Unique coupon code (uppercase) */
//   code: string;
//   type: DiscountType;
//   /** Flat amount (INR) or percentage (0..100) */
//   value: number;
//   /** Minimum order total required to apply */
//   minOrderTotal?: number;
//   /** Maximum discount cap in INR (applies to percent coupons) */
//   maxDiscountCap?: number;
//   /** ISO date string — coupon invalid after this */
//   expiresAt?: string;
//   /** Null = unlimited */
//   usageLimit?: number | null;
//   usageCount?: number;
// };

// // ─── Input to the pricing engine ─────────────────────────────────────────────
// export type PricingInput = {
//   serviceKey: ServiceKey;
//   /** Base price in INR for the chosen service/sub-option */
//   basePrice: number;
//   /** Platform convenience fee per order (INR) */
//   convenienceFee: number;
//   /** GST rate as a decimal, e.g. 0.18 for 18% */
//   gstRate: number;
//   /** Emergency surcharge in INR (applied only when emergency === true) */
//   emergencySurcharge: number;
//   emergency: boolean;
//   /** Fraction of total paid to the technician (0..1) */
//   technicianCommissionRate: number;
//   /** Fraction of total paid to the supplier (0..1) */
//   supplierCommissionRate: number;
//   /** Optional coupon to apply */
//   coupon?: Coupon | null;
//   /** Water-can delivery: number of cans */
//   canCount?: number;
//   /** Price per can (INR) — used when serviceKey === 'water_tanker' */
//   pricePerCan?: number;
// };

// // ─── Output of the pricing engine ────────────────────────────────────────────
// export type PriceBreakdown = {
//   serviceKey: ServiceKey;
//   /** Line items (ordered for display) */
//   lines: PriceLine[];
//   /** Subtotal before GST and extras */
//   subtotal: number;
//   convenienceFee: number;
//   gstRate: number;
//   gstAmount: number;
//   emergencySurcharge: number;
//   /** Discount applied (0 when no coupon) */
//   discountAmount: number;
//   /** Coupon code that was applied, if any */
//   appliedCoupon: string | null;
//   /** Grand total charged to customer */
//   total: number;
//   /** Amount paid to technician */
//   technicianEarnings: number;
//   /** Amount paid to supplier */
//   supplierEarnings: number;
//   /** Platform net revenue */
//   platformRevenue: number;
//   /** True when revenue integrity check passes */
//   valid: boolean;
// };

// export type PriceLine = {
//   label: string;
//   amount: number;
//   /** Positive = charge, negative = discount */
//   sign: 1 | -1;
//   note?: string;
// };

// // ─── Utility functions (internal) ────────────────────────────────────────────

// /** Round to 2 decimal places, epsilon-safe */
// function r2(n: number): number {
//   return Math.round((n + Number.EPSILON) * 100) / 100;
// }

// /** Clamp a value to [0, 1] */
// function clamp01(n: number): number {
//   return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
// }

// /** Clamp a value to [min, Infinity] */
// function clampMin(n: number, min = 0): number {
//   return Number.isFinite(n) ? Math.max(min, n) : min;
// }

// // ─── Coupon evaluation ───────────────────────────────────────────────────────

// export type CouponResult =
//   | { valid: true; discount: number; message: string }
//   | { valid: false; discount: 0; error: string };

// /**
//  * Validate and compute the discount for a coupon against a pre-discount subtotal.
//  * Does NOT modify order total — caller applies the returned discount.
//  */
// export function evaluateCoupon(
//   coupon: Coupon,
//   preTaxSubtotal: number,
// ): CouponResult {
//   // Expiry check
//   if (coupon.expiresAt) {
//     if (new Date(coupon.expiresAt) < new Date()) {
//       return { valid: false, discount: 0, error: 'This coupon has expired.' };
//     }
//   }

//   // Usage limit check
//   if (
//     coupon.usageLimit != null &&
//     (coupon.usageCount ?? 0) >= coupon.usageLimit
//   ) {
//     return { valid: false, discount: 0, error: 'Coupon usage limit reached.' };
//   }

//   // Minimum order check
//   if (coupon.minOrderTotal != null && preTaxSubtotal < coupon.minOrderTotal) {
//     return {
//       valid: false,
//       discount: 0,
//       error: `Minimum order value of ₹${coupon.minOrderTotal} required.`,
//     };
//   }

//   let discount: number;
//   if (coupon.type === 'flat') {
//     discount = r2(clampMin(coupon.value));
//   } else {
//     const pct = clamp01(coupon.value / 100);
//     discount = r2(preTaxSubtotal * pct);
//     if (coupon.maxDiscountCap != null) {
//       discount = r2(Math.min(discount, coupon.maxDiscountCap));
//     }
//   }

//   // Discount cannot exceed the subtotal
//   discount = r2(Math.min(discount, preTaxSubtotal));

//   return {
//     valid: true,
//     discount,
//     message:
//       coupon.type === 'flat'
//         ? `₹${discount} off applied`
//         : `${coupon.value}% off — saved ₹${discount}`,
//   };
// }

// // ─── Core pricing function ────────────────────────────────────────────────────

// /**
//  * Calculate the complete price breakdown for a water-service order.
//  *
//  * Revenue integrity guarantee:
//  *   technicianEarnings + supplierEarnings + platformRevenue === total
//  *
//  * @example
//  * const bd = calculateOrderTotal({
//  *   serviceKey: 'water_tanker',
//  *   basePrice: 350,
//  *   convenienceFee: 29,
//  *   gstRate: 0.18,
//  *   emergencySurcharge: 199,
//  *   emergency: false,
//  *   technicianCommissionRate: 0.70,
//  *   supplierCommissionRate: 0.10,
//  * });
//  * // bd.total === 449, bd.valid === true
//  */
// export function calculateOrderTotal(input: PricingInput): PriceBreakdown {
//   const lines: PriceLine[] = [];

//   // ── 1. Base price (water-can override) ──────────────────────────────────────
//   let base: number;
//   if (
//     input.serviceKey === 'water_tanker' &&
//     input.canCount != null &&
//     input.pricePerCan != null
//   ) {
//     base = r2(clampMin(input.canCount) * clampMin(input.pricePerCan));
//     lines.push({
//       label: `Water Cans (${input.canCount} × ₹${input.pricePerCan})`,
//       amount: base,
//       sign: 1,
//     });
//   } else {
//     base = r2(clampMin(input.basePrice));
//     lines.push({ label: 'Service Charge', amount: base, sign: 1 });
//   }

//   // ── 2. Convenience fee ──────────────────────────────────────────────────────
//   const convFee = r2(clampMin(input.convenienceFee));
//   if (convFee > 0) {
//     lines.push({
//       label: 'Convenience Fee',
//       amount: convFee,
//       sign: 1,
//       note: 'Platform processing',
//     });
//   }

//   // ── 3. Subtotal (taxable base) ──────────────────────────────────────────────
//   const subtotal = r2(base + convFee);

//   // ── 4. Coupon discount (applied on subtotal, before GST) ───────────────────
//   let discountAmount = 0;
//   let appliedCoupon: string | null = null;

//   if (input.coupon) {
//     const res = evaluateCoupon(input.coupon, subtotal);
//     if (res.valid) {
//       discountAmount = res.discount;
//       appliedCoupon = input.coupon.code;
//       lines.push({
//         label: `Coupon: ${input.coupon.code}`,
//         amount: discountAmount,
//         sign: -1,
//         note: res.message,
//       });
//     }
//   }

//   const taxableBase = r2(Math.max(0, subtotal - discountAmount));

//   // ── 5. GST ──────────────────────────────────────────────────────────────────
//   const gstRate = clamp01(input.gstRate);
//   const gstAmount = r2(taxableBase * gstRate);
//   if (gstAmount > 0) {
//     lines.push({
//       label: `GST (${Math.round(gstRate * 100)}%)`,
//       amount: gstAmount,
//       sign: 1,
//       note: 'Govt. tax on taxable amount',
//     });
//   }

//   // ── 6. Emergency surcharge ──────────────────────────────────────────────────
//   const emergencySurcharge = input.emergency
//     ? r2(clampMin(input.emergencySurcharge))
//     : 0;
//   if (emergencySurcharge > 0) {
//     lines.push({
//       label: '🚨 Emergency Surcharge',
//       amount: emergencySurcharge,
//       sign: 1,
//       note: 'Priority booking fee',
//     });
//   }

//   // ── 7. Grand total ──────────────────────────────────────────────────────────
//   const total = r2(
//     taxableBase + gstAmount + emergencySurcharge,
//   );

//   // ── 8. Revenue split ────────────────────────────────────────────────────────
//   let techRate = clamp01(input.technicianCommissionRate);
//   let supplierRate = clamp01(input.supplierCommissionRate);

//   // Prevent over-allocation: scale down proportionally if rates exceed 100%
//   const combinedRate = techRate + supplierRate;
//   if (combinedRate > 1) {
//     techRate = r2(techRate / combinedRate);
//     supplierRate = r2(supplierRate / combinedRate);
//   }

//   const technicianEarnings = r2(total * techRate);
//   const supplierEarnings = r2(total * supplierRate);
//   // Residual method guarantees integrity
//   const platformRevenue = r2(
//     Math.max(0, total - technicianEarnings - supplierEarnings),
//   );

//   const valid = validateRevenueIntegrity({
//     technicianEarnings,
//     supplierEarnings,
//     platformRevenue,
//     total,
//   });

//   return {
//     serviceKey: input.serviceKey,
//     lines,
//     subtotal,
//     convenienceFee: convFee,
//     gstRate,
//     gstAmount,
//     emergencySurcharge,
//     discountAmount,
//     appliedCoupon,
//     total,
//     technicianEarnings,
//     supplierEarnings,
//     platformRevenue,
//     valid,
//   };
// }

// // ─── Revenue integrity validator ─────────────────────────────────────────────

// /**
//  * Verify that the three revenue legs sum to the order total.
//  * Call this before persisting any order to storage / DB.
//  */
// export function validateRevenueIntegrity(params: {
//   technicianEarnings: number;
//   supplierEarnings: number;
//   platformRevenue: number;
//   total: number;
// }): boolean {
//   const sum = r2(
//     params.technicianEarnings +
//       params.supplierEarnings +
//       params.platformRevenue,
//   );
//   return r2(sum) === r2(params.total);
// }

// // ─── Formatting helpers (UI layer) ───────────────────────────────────────────

// /** Format a number as Indian Rupees: ₹1,29,999 */
// export function formatINR(amount: number): string {
//   const n = Number.isFinite(amount) ? amount : 0;
//   return '₹' + Math.round(n).toLocaleString('en-IN');
// }

// /** Format INR with paise: ₹1,299.50 */
// export function formatINRWithPaise(amount: number): string {
//   const n = Number.isFinite(amount) ? amount : 0;
//   return (
//     '₹' +
//     n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
//   );
// }

// /** Format a rate as percentage string: 0.18 → "18%" */
// export function formatRate(rate: number): string {
//   return `${Math.round(clamp01(rate) * 100)}%`;
// }

// /** Format a compact amount: 1299 → "₹1.3K", 150000 → "₹1.5L" */
// export function formatINRCompact(amount: number): string {
//   const n = Number.isFinite(amount) ? Math.abs(amount) : 0;
//   if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}Cr`;
//   if (n >= 1_00_000)  return `₹${(n / 1_00_000).toFixed(1)}L`;
//   if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
//   return formatINR(amount);
// }

// // ─── Batch / reporting helpers ────────────────────────────────────────────────

// export type OrderForStats = {
//   status: OrderStatus;
//   total: number;
//   technicianEarnings: number;
//   supplierEarnings: number;
//   platformRevenue: number;
//   createdAt: number; // epoch ms
//   serviceKey: ServiceKey;
// };

// export type RevenueStats = {
//   totalOrders: number;
//   completedOrders: number;
//   cancelledOrders: number;
//   activeOrders: number;
//   grossRevenue: number;           // sum of completed order totals
//   technicianPayouts: number;
//   supplierPayouts: number;
//   platformNetRevenue: number;
//   averageOrderValue: number;
//   completionRate: number;         // 0..1
//   byService: Record<ServiceKey, { count: number; revenue: number }>;
// };

// /**
//  * Aggregate revenue stats from a list of orders.
//  * Filters to only completed orders for monetary figures.
//  */
// export function computeRevenueStats(orders: OrderForStats[]): RevenueStats {
//   const completed = orders.filter(o => o.status === 'COMPLETED');
//   const cancelled = orders.filter(o => o.status === 'CANCELLED');
//   const active    = orders.filter(
//     o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED',
//   );

//   const grossRevenue       = r2(completed.reduce((s, o) => s + o.total, 0));
//   const technicianPayouts  = r2(completed.reduce((s, o) => s + o.technicianEarnings, 0));
//   const supplierPayouts    = r2(completed.reduce((s, o) => s + o.supplierEarnings, 0));
//   const platformNetRevenue = r2(completed.reduce((s, o) => s + o.platformRevenue, 0));

//   const byService = {} as Record<ServiceKey, { count: number; revenue: number }>;
//   const keys: ServiceKey[] = [
//     'water_tanker','ro_service','plumbing','borewell','motor_pump','tank_cleaning',
//   ];
//   for (const k of keys) byService[k] = { count: 0, revenue: 0 };
//   for (const o of completed) {
//     byService[o.serviceKey].count   += 1;
//     byService[o.serviceKey].revenue  = r2(byService[o.serviceKey].revenue + o.total);
//   }

//   return {
//     totalOrders:      orders.length,
//     completedOrders:  completed.length,
//     cancelledOrders:  cancelled.length,
//     activeOrders:     active.length,
//     grossRevenue,
//     technicianPayouts,
//     supplierPayouts,
//     platformNetRevenue,
//     averageOrderValue: completed.length > 0 ? r2(grossRevenue / completed.length) : 0,
//     completionRate:   orders.length > 0 ? r2(completed.length / orders.length) : 0,
//     byService,
//   };
// }

// /**
//  * Filter orders to a time window.
//  */
// export function filterByPeriod(
//   orders: OrderForStats[],
//   period: 'today' | 'week' | 'month' | 'all',
// ): OrderForStats[] {
//   if (period === 'all') return orders;
//   const now  = Date.now();
//   const msDay = 86_400_000;
//   const start =
//     period === 'today' ? now - msDay :
//     period === 'week'  ? now - 7 * msDay :
//     now - 30 * msDay;
//   return orders.filter(o => o.createdAt >= start);
// }

// /**
//  * Build a 7-day daily revenue series (last 7 days, index 0 = 7 days ago).
//  * Returns [{ label: 'Mon', amount: 2340 }, ...]
//  */
// export function buildDailyRevenueSeries(
//   orders: OrderForStats[],
// ): { label: string; amount: number; date: string }[] {
//   const completed = orders.filter(o => o.status === 'COMPLETED');
//   const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

//   return Array.from({ length: 7 }, (_, i) => {
//     const d = new Date();
//     d.setDate(d.getDate() - (6 - i));
//     const dateStr = d.toISOString().slice(0, 10);
//     const amount = r2(
//       completed
//         .filter(o => new Date(o.createdAt).toISOString().slice(0, 10) === dateStr)
//         .reduce((s, o) => s + o.total, 0),
//     );
//     return {
//       label: i === 6 ? 'Today' : days[d.getDay()],
//       amount,
//       date: dateStr,
//     };
//   });
// }

// // ─── Savings helper (for customer dashboard) ─────────────────────────────────

// /**
//  * Compute total customer savings from all applied coupons.
//  * Requires orders enriched with discountAmount field.
//  */
// export function computeCustomerSavings(
//   orders: (OrderForStats & { discountAmount?: number })[],
// ): number {
//   return r2(
//     orders
//       .filter(o => o.status === 'COMPLETED')
//       .reduce((s, o) => s + (o.discountAmount ?? 0), 0),
//   );
// }

// // ─── Type guards ──────────────────────────────────────────────────────────────

// export function isServiceKey(key: string): key is ServiceKey {
//   return [
//     'water_tanker','ro_service','plumbing',
//     'borewell','motor_pump','tank_cleaning',
//   ].includes(key);
// }

// export function isCompletedOrder(
//   o: OrderForStats,
// ): o is OrderForStats & { status: 'COMPLETED' } {
//   return o.status === 'COMPLETED';
// }

// // ─── Constants (UI helpers) ───────────────────────────────────────────────────

// export const SERVICE_LABELS: Record<ServiceKey, string> = {
//   water_tanker:  'Water Tanker',
//   ro_service:    'RO Service',
//   plumbing:      'Plumbing',
//   borewell:      'Borewell',
//   motor_pump:    'Motor & Pump',
//   tank_cleaning: 'Tank Cleaning',
// };

// export const SERVICE_EMOJI: Record<ServiceKey, string> = {
//   water_tanker:  '🚛',
//   ro_service:    '💧',
//   plumbing:      '🔧',
//   borewell:      '⛏️',
//   motor_pump:    '⚙️',
//   tank_cleaning: '🪣',
// };

// export const ALL_SERVICE_KEYS: ServiceKey[] = [
//   'water_tanker','ro_service','plumbing','borewell','motor_pump','tank_cleaning',
// ];
