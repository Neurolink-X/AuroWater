/**
 * Backward-compatible alias.
 *
 * The previous implementation returned success without persisting anything.
 * Keep old clients working while routing them through the real payout-request
 * transaction.
 */
export { POST } from '../payouts/route';
