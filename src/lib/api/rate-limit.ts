// PATH: src/lib/api/rate-limit.ts
import 'server-only';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Durable rate limiting on top of the consume_account_recovery_rate_limit() SQL function
 * (it is generic: it only sees an opaque 64-char key). Keys are HMACs, never raw ids.
 */
export type RateResult = { allowed: boolean; retryAfter: number; unavailable: boolean };

export async function consumeRateLimit(
  db: SupabaseClient, scope: string, id: string, max: number, windowSeconds: number,
): Promise<RateResult> {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.ACCOUNT_RECOVERY_RATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return { allowed: false, retryAfter: 60, unavailable: true };
  const key = createHmac('sha256', secret).update(`${scope}:${id}`).digest('hex');
  try {
    const { data, error } = await db.rpc('consume_account_recovery_rate_limit', {
      p_key_hash: key, p_max: max, p_window_seconds: windowSeconds,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row || typeof row.allowed !== 'boolean') {
      return { allowed: false, retryAfter: 60, unavailable: true };
    }
    return { allowed: row.allowed, retryAfter: Math.max(0, Number(row.retry_after) || 0), unavailable: false };
  } catch {
    // Network failures and unexpected RPC exceptions must also be visible
    // as unavailable; the calling route chooses its own fail-closed policy.
    return { allowed: false, retryAfter: 60, unavailable: true };
  }
}
