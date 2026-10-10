/**
 * Single source of truth for customer-facing water-can pricing and the
 * "typical local price" used for savings messaging in the booking flow.
 *
 * ┌─ IMPORTANT ──────────────────────────────────────────────────────────────┐
 * │ MARKET_CAN_PRICES are PLACEHOLDERS. Replace them with the real, verifiable │
 * │ average delivered price of a 20L can in your cities before launch.        │
 * │ Price comparisons and "% off" claims must be truthful (India's consumer   │
 * │ protection rules on misleading advertisements apply). If you cannot back  │
 * │ the numbers up, set SHOW_MARKET_COMPARISON to false and the whole         │
 * │ comparison UI disappears, while your own prices keep working.             │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

/** Your approved launch prices for 20L RO cans (₹ per can, delivery included). */
export const CAN_PRICES = {
  normal: 20,
  chilled: 25,
  subscription: 18,
  bulk: 20,
} as const;

/** Master switch for every "market price / % off / you save" element. */
export const SHOW_MARKET_COMPARISON = true;

/** ⚠ PLACEHOLDERS: typical local delivered price per 20L can. Verify, then edit. */
export const MARKET_CAN_PRICES = {
  normal: 30,
  chilled: 40,
} as const;

export const MARKET_PRICE_NOTE =
  'Typical local price for a 20L can with delivery. Actual prices vary by area.';

/** Whole-number percentage saved versus the market price (0 if not cheaper). */
export function pctOff(market: number, ours: number): number {
  if (!(market > ours) || market <= 0) return 0;
  return Math.round(((market - ours) / market) * 100);
}
