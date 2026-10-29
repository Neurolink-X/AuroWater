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
  const [eventsResult, streaksResult, settingsResult, balanceResult] = await Promise.all([
    admin.from('subscription_loyalty_events')
      .select('id, subscription_id, order_id, event_type, points_delta, description, created_at, metadata')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('subscription_loyalty_streaks')
      .select('subscription_id, last_renewal_month, consecutive_months')
      .eq('customer_id', customerId),
    admin.from('settings')
      .select('key, value')
      .in('key', [
        'subscription_loyalty_enabled',
        'subscription_loyalty_points_per_renewal',
        'subscription_loyalty_points_per_reward',
        'subscription_loyalty_streak_months',
        'subscription_loyalty_streak_bonus_points',
        'subscription_loyalty_points_per_rupee',
        'subscription_loyalty_max_discount_percent',
        'subscription_loyalty_plumbing_enabled',
        'subscription_loyalty_tank_cleaning_enabled',
        'subscription_loyalty_free_can_enabled',
        'subscription_loyalty_service_discount_enabled',
      ]),
    admin.rpc('subscription_loyalty_balance', { p_customer_id: customerId }),
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
  if (settingsResult.error) {
    console.error('[customer/loyalty] settings read failed', settingsResult.error.message);
    return jsonErr('Loyalty offers are temporarily unavailable.', 503);
  }
  if (balanceResult.error) {
    console.error('[customer/loyalty] lifetime balance read failed', balanceResult.error.message);
    return jsonErr('Loyalty balance is temporarily unavailable. Please retry shortly.', 503);
  }

  const events = eventsResult.error ? [] : eventsResult.data ?? [];
  const streaks = streaksResult.error ? [] : streaksResult.data ?? [];
  const settings = Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, row.value])) as Record<string, string>;
  const pointsBalance = Number(balanceResult.data ?? 0);
  const rewardTarget = Math.max(100, Number(settings.subscription_loyalty_points_per_reward ?? 300));
  const remainder = ((pointsBalance % rewardTarget) + rewardTarget) % rewardTarget;
  const enabled = settings.subscription_loyalty_enabled !== 'false';

  return jsonOk({
    points_balance: pointsBalance,
    points_to_next_reward: pointsBalance >= rewardTarget && remainder === 0 ? 0 : Math.max(0, rewardTarget - remainder),
    points_per_renewal: Number(settings.subscription_loyalty_points_per_renewal ?? 100),
    streak_months: Number(settings.subscription_loyalty_streak_months ?? 3),
    streak_bonus_points: Number(settings.subscription_loyalty_streak_bonus_points ?? 100),
    enabled,
    offers: {
      free_can: enabled && settings.subscription_loyalty_free_can_enabled !== 'false',
      service_discount: enabled && settings.subscription_loyalty_service_discount_enabled !== 'false',
      plumbing: settings.subscription_loyalty_plumbing_enabled !== 'false',
      tank_cleaning: settings.subscription_loyalty_tank_cleaning_enabled !== 'false',
      points_per_rupee: Number(settings.subscription_loyalty_points_per_rupee ?? 1),
      max_discount_percent: Number(settings.subscription_loyalty_max_discount_percent ?? 20),
      points_per_reward: rewardTarget,
    },
    streaks,
    events,
    history_limit: 100,
  });
}
