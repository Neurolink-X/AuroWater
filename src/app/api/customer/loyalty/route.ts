import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const customerId = auth.ctx.profile.id;
  const admin = createServiceClient();
  const [eventsResult, streaksResult] = await Promise.all([
    admin.from('subscription_loyalty_events')
      .select('id, subscription_id, order_id, event_type, points_delta, description, created_at, metadata')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('subscription_loyalty_streaks')
      .select('subscription_id, last_renewal_month, consecutive_months')
      .eq('customer_id', customerId),
  ]);

  const missingTable = (error: { code?: string } | null) => Boolean(error && ['42P01', 'PGRST205'].includes(String(error.code ?? '')));
  if (eventsResult.error && !missingTable(eventsResult.error)) {
    console.error('[customer/loyalty] ledger read failed', eventsResult.error.message);
    return jsonErr('Loyalty balance is temporarily unavailable.', 503);
  }
  if (streaksResult.error && !missingTable(streaksResult.error)) {
    console.error('[customer/loyalty] streak read failed', streaksResult.error.message);
    return jsonErr('Subscription streak is temporarily unavailable.', 503);
  }

  const events = eventsResult.error ? [] : eventsResult.data ?? [];
  const streaks = streaksResult.error ? [] : streaksResult.data ?? [];
  const pointsBalance = events.reduce((sum, event) => sum + Number(event.points_delta || 0), 0);
  const rewardTarget = Math.max(1, Number((await admin.from('settings').select('value').eq('key', 'subscription_loyalty_points_per_reward').maybeSingle()).data?.value ?? 300));
  const remainder = ((pointsBalance % rewardTarget) + rewardTarget) % rewardTarget;
  return jsonOk({
    points_balance: pointsBalance,
    points_to_next_reward: pointsBalance >= 0 && remainder === 0 ? rewardTarget : Math.max(0, rewardTarget - remainder),
    points_per_renewal: Number((await admin.from('settings').select('value').eq('key', 'subscription_loyalty_points_per_renewal').maybeSingle()).data?.value ?? 100),
    streaks,
    events,
  });
}
