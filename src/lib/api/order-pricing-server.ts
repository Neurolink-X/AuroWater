
/**
 * AuroTap server-side pricing helpers.
 *
 * Used by customer/admin order APIs.
 * All prices are in INR.
 *
 * IMPORTANT:
 * The order routes must call getWaterCanUnitPrice() when calculating
 * water order amounts. Exporting a helper alone does not change pricing.
 */

export const WATER_CAN_PRICES = Object.freeze({
  normal: 20,
  chilled: 25,
  subscription: 20,
});

export type WaterCanPricingOption = 'normal' | 'chilled';

export interface WaterCanPriceParams {
  option: WaterCanPricingOption;
  subscription?: boolean;
}

export interface ExpectedTotal {
  gst: number;
  total: number;
}

function assertNonNegativeFinite(
  value: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite, non-negative amount`);
  }
}

function roundRupees(value: number): number {
  return Math.round(value);
}

/**
 * Returns the canonical approved unit price for a water can.
 *
 * Normal RO: ₹20
 * Chilled RO: ₹25
 * Subscription RO: ₹20 (same rate as one-time normal RO)
 *
 * Subscription orders cannot use chilled RO.
 * Client-supplied prices and stale settings are never trusted.
 */
export function getWaterCanUnitPrice(
  params: WaterCanPriceParams,
): number {
  const { option, subscription = false } = params;

  if (option !== 'normal' && option !== 'chilled') {
    throw new Error('Invalid water-can pricing option');
  }

  if (subscription && option === 'chilled') {
    throw new Error('Chilled RO is available for one-time orders only');
  }

  if (subscription) {
    return WATER_CAN_PRICES.subscription;
  }

  return option === 'chilled'
    ? WATER_CAN_PRICES.chilled
    : WATER_CAN_PRICES.normal;
}

/**
 * Recomputes the order total on the server.
 *
 * GST rate is decimal-based:
 *   0    = no GST applied
 *   0.18 = 18% GST
 *
 * Preserves the existing whole-rupee GST rounding behaviour.
 * Tax treatment must match the business's confirmed tax configuration.
 */
export function computeExpectedTotal(
  base: number,
  convenience: number,
  emergency: number,
  gstRate: number,
): ExpectedTotal {
  assertNonNegativeFinite(base, 'Base amount');
  assertNonNegativeFinite(convenience, 'Convenience fee');
  assertNonNegativeFinite(emergency, 'Emergency charge');
  assertNonNegativeFinite(gstRate, 'GST rate');

  if (gstRate > 1) {
    throw new RangeError(
      'GST rate must be decimal-based (for example, 0.18 for 18%)',
    );
  }

  const subtotal = base + convenience + emergency;
  const gst = roundRupees(subtotal * gstRate);
  const total = subtotal + gst;

  return { gst, total };
}

/**
 * Compares the customer's displayed total against the server-calculated
 * total. The server must save the server-calculated value, never the
 * client-provided amount.
 */
export function totalsMatch(
  clientTotal: number,
  base: number,
  convenience: number,
  emergency: number,
  gstRate: number,
  tolerance = 0.5,
): boolean {
  if (
    !Number.isFinite(clientTotal) ||
    !Number.isFinite(tolerance) ||
    tolerance < 0
  ) {
    return false;
  }

  try {
    const { total } = computeExpectedTotal(
      base,
      convenience,
      emergency,
      gstRate,
    );

    return Math.abs(clientTotal - total) <= tolerance;
  } catch {
    return false;
  }
}

/**
 * Converts stored GST settings to a decimal rate.
 * Supports legacy values such as 18 and decimal values such as 0.18.
 *
 * Missing or invalid values default to 0, avoiding an unapproved tax charge.
 * Enable a different fallback only after the tax policy is confirmed.
 */
export function pickGstRateFromFlat(
  map: Record<string, string>,
): number {
  const raw = map.gst_rate;

  if (raw === undefined || raw.trim() === '') {
    return 0;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  const rate = value > 1 ? value / 100 : value;

  return rate <= 1 ? rate : 0;
}










// /** Recompute GST-inclusive total from components (₹ rounded). */
// export function computeExpectedTotal(
//   base: number,
//   convenience: number,
//   emergency: number,
//   gstRate: number
// ): { gst: number; total: number } {
//   const sub = Math.max(0, base) + Math.max(0, convenience) + Math.max(0, emergency);
//   const gst = Math.round(sub * gstRate);
//   const total = sub + gst;
//   return { gst, total };
// }

// /** Returns true if client total matches server expectation within `tol` rupees. */
// export function totalsMatch(
//   clientTotal: number,
//   base: number,
//   convenience: number,
//   emergency: number,
//   gstRate: number,
//   tol = 2
// ): boolean {
//   const { total } = computeExpectedTotal(base, convenience, emergency, gstRate);
//   return Math.abs(clientTotal - total) <= tol;
// }

// /** Parse gst_rate from flat settings map (`18` or `0.18`). */
// export function pickGstRateFromFlat(map: Record<string, string>): number {
//   const g = map.gst_rate;
//   if (g === undefined) return 0.18;
//   const n = Number(g);
//   if (!Number.isFinite(n)) return 0.18;
//   return n > 1 ? n / 100 : n;
// }
