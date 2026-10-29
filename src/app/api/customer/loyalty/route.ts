import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { flag, isMissingTable, num, rewardProgress, streakBonusIn, withRetry } from '@/lib/loyalty';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const LEDGER_SUM_CAP = 10_000;

const SETTING_KEYS = [
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
];

type Settings = Record<string, string>;

/** Per-instance settings cache: fresh for 60s, served stale for up to 1h if the DB is struggling. */
let settingsCache: { at: number; value: Settings } | null = null;
const SETTINGS_FRESH_MS = 60_000;
const SETTINGS_STALE_MS = 60 * 60_000;

type AdminClient = ReturnType<typeof createServiceClient>;

async function loadSettings(admin: AdminClient): Promise<{ value: Settings | null; source: 'fresh' | 'cache' | 'stale' | 'none' }> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < SETTINGS_FRESH_MS) return { value: settingsCache.value, source: 'cache' };

  const res = await withRetry(() => admin.from('settings').select('key, value').in('key', SETTING_KEYS));
  if (!res.error) {
    const value = Object.fromEntries((res.data ?? []).map((row) => [row.key, String(row.value)])) as Settings;
    settingsCache = { at: now, value };
    return { value, source: 'fresh' };
  }
  console.error('[customer/loyalty] settings read failed', res.error.message);
  if (settingsCache && now - settingsCache.at < SETTINGS_STALE_MS) return { value: settingsCache.value, source: 'stale' };
  return { value: null, source: 'none' };
}

type Cursor = { t: string; i: string };

function encodeCursor(c: Cursor) {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

/** Returns null (no cursor), a valid Cursor, or 'invalid'. Values are strictly validated before use in a filter. */
function decodeCursor(raw: string | null): Cursor | null | 'invalid' {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof parsed.t !== 'string' || !/^[0-9T:.\-+Z]{10,40}$/.test(parsed.t) || Number.isNaN(Date.parse(parsed.t))) return 'invalid';
    if (typeof parsed.i !== 'string' || !/^[\w-]{1,64}$/.test(parsed.i)) return 'invalid';
    return { t: parsed.t, i: parsed.i };
  } catch {
    return 'invalid';
  }
}

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const params = req.nextUrl.searchParams;
  const limit = Math.trunc(num(params.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT));
  const cursor = decodeCursor(params.get('cursor'));
  if (cursor === 'invalid') return jsonErr('Invalid cursor.', 400);

  const customerId = auth.ctx.profile.id;
  const admin = createServiceClient();
  const log = (msg: string, detail?: unknown) => console.error(`[customer/loyalty][${requestId}] ${msg}`, detail ?? '');
  const degraded: string[] = [];

  const [eventsRes, streaksRes, settingsOut, balanceRes] = await Promise.all([
    withRetry(() => {
      let q = admin
        .from('subscription_loyalty_events')
        // metadata is intentionally not selected: internal, never shown to customers.
        .select('id, subscription_id, order_id, event_type, points_delta, description, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
      if (cursor) q = q.or(`created_at.lt.${cursor.t},and(created_at.eq.${cursor.t},id.lt.${cursor.i})`);
      return q;
    }),
    withRetry(() =>
      admin.from('subscription_loyalty_streaks').select('subscription_id, last_renewal_month, consecutive_months').eq('customer_id', customerId),
    ),
    loadSettings(admin),
    withRetry(() => admin.rpc('subscription_loyalty_balance', { p_customer_id: customerId })),
  ]);

  // ---- Activity ledger: degrade to empty instead of failing the whole page.
  let events = eventsRes.data ?? [];
  if (eventsRes.error) {
    events = [];
    if (!isMissingTable(eventsRes.error)) {
      log('ledger read failed', eventsRes.error.message);
      degraded.push('activity_unavailable');
    }
  }
  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ t: String(last.created_at), i: String(last.id) }) : null;

  // ---- Streaks: degrade to empty.
  let streakRows = streaksRes.data ?? [];
  if (streaksRes.error) {
    streakRows = [];
    if (!isMissingTable(streaksRes.error)) {
      log('streak read failed', streaksRes.error.message);
      degraded.push('streaks_unavailable');
    }
  }

  // ---- Settings: fresh > cache > stale > safe defaults with offers hidden.
  const settings = settingsOut.value ?? {};
  if (settingsOut.source === 'stale') degraded.push('settings_stale');
  if (settingsOut.source === 'none') degraded.push('offers_unavailable');
  const settingsKnown = settingsOut.value !== null;

  // ---- Balance: authoritative RPC, self-heal by summing the ledger if the RPC fails.
  let pointsBalance: number;
  if (!balanceRes.error) {
    pointsBalance = num(balanceRes.data, 0, 0);
    // Drift detector: with the full ledger in view, the sum must equal the RPC balance.
    if (!cursor && !hasMore && page.length > 0) {
      const sum = page.reduce((acc, e) => acc + num(e.points_delta, 0), 0);
      if (sum !== pointsBalance) log(`balance drift: rpc=${pointsBalance} ledger=${sum} customer=${customerId}`);
    }
  } else {
    log('balance rpc failed, falling back to ledger', balanceRes.error.message);
    const ledger = await withRetry(() =>
      admin.from('subscription_loyalty_events').select('points_delta').eq('customer_id', customerId).limit(LEDGER_SUM_CAP),
    );
    if (ledger.error && !isMissingTable(ledger.error)) {
      log('ledger fallback failed', ledger.error.message);
      return jsonErr('Loyalty balance is temporarily unavailable. Please retry shortly.', 503);
    }
    const rows = ledger.error ? [] : ledger.data ?? [];
    pointsBalance = Math.max(0, rows.reduce((acc, r) => acc + num(r.points_delta, 0), 0));
    degraded.push('balance_recalculated');
  }

  const rewardTarget = Math.max(100, Math.trunc(num(settings.subscription_loyalty_points_per_reward, 300, 1)));
  const progress = rewardProgress(pointsBalance, rewardTarget);
  const streakMonths = Math.max(1, Math.trunc(num(settings.subscription_loyalty_streak_months, 3, 1, 24)));
  const enabled = flag(settings.subscription_loyalty_enabled);

  return jsonOk({
    status: degraded.length ? 'degraded' : 'ok',
    degraded,
    request_id: requestId,
    points_balance: pointsBalance,
    points_to_next_reward: progress.pointsToNext,
    rewards_available: progress.rewardsAvailable,
    progress_percent: progress.percent,
    points_per_renewal: num(settings.subscription_loyalty_points_per_renewal, 100, 0),
    streak_months: streakMonths,
    streak_bonus_points: num(settings.subscription_loyalty_streak_bonus_points, 100, 0),
    enabled,
    offers: {
      // If settings could not be read at all, hide offers rather than promise something unverified.
      free_can: settingsKnown && enabled && flag(settings.subscription_loyalty_free_can_enabled),
      service_discount: settingsKnown && enabled && flag(settings.subscription_loyalty_service_discount_enabled),
      plumbing: flag(settings.subscription_loyalty_plumbing_enabled),
      tank_cleaning: flag(settings.subscription_loyalty_tank_cleaning_enabled),
      points_per_rupee: num(settings.subscription_loyalty_points_per_rupee, 1, 0),
      max_discount_percent: num(settings.subscription_loyalty_max_discount_percent, 20, 0, 100),
      points_per_reward: rewardTarget,
    },
    streaks: streakRows.map((s) => {
      const consecutive = Math.max(0, Math.trunc(num(s.consecutive_months, 0)));
      return {
        subscription_id: s.subscription_id,
        last_renewal_month: s.last_renewal_month ?? null,
        consecutive_months: consecutive,
        bonus_in: streakBonusIn(consecutive, streakMonths),
      };
    }),
    events: page,
    has_more: hasMore,
    next_cursor: nextCursor,
  });
}









// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
// import { createServiceClient } from '@/utils/supabase/server';

// export const dynamic = 'force-dynamic';
// export const runtime = 'nodejs';

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

//   const customerId = auth.ctx.profile.id;
//   const admin = createServiceClient();
//   const [eventsResult, streaksResult, settingsResult, balanceResult] = await Promise.all([
//     admin.from('subscription_loyalty_events')
//       .select('id, subscription_id, order_id, event_type, points_delta, description, created_at, metadata')
//       .eq('customer_id', customerId)
//       .order('created_at', { ascending: false })
//       .limit(100),
//     admin.from('subscription_loyalty_streaks')
//       .select('subscription_id, last_renewal_month, consecutive_months')
//       .eq('customer_id', customerId),
//     admin.from('settings')
//       .select('key, value')
//       .in('key', [
//         'subscription_loyalty_enabled',
//         'subscription_loyalty_points_per_renewal',
//         'subscription_loyalty_points_per_reward',
//         'subscription_loyalty_streak_months',
//         'subscription_loyalty_streak_bonus_points',
//         'subscription_loyalty_points_per_rupee',
//         'subscription_loyalty_max_discount_percent',
//         'subscription_loyalty_plumbing_enabled',
//         'subscription_loyalty_tank_cleaning_enabled',
//         'subscription_loyalty_free_can_enabled',
//         'subscription_loyalty_service_discount_enabled',
//       ]),
//     admin.rpc('subscription_loyalty_balance', { p_customer_id: customerId }),
//   ]);

//   const missingTable = (error: { code?: string } | null) => Boolean(error && ['42P01', 'PGRST205'].includes(String(error.code ?? '')));
//   if (eventsResult.error && !missingTable(eventsResult.error)) {
//     console.error('[customer/loyalty] ledger read failed', eventsResult.error.message);
//     return jsonErr('Loyalty balance is temporarily unavailable.', 503);
//   }
//   if (streaksResult.error && !missingTable(streaksResult.error)) {
//     console.error('[customer/loyalty] streak read failed', streaksResult.error.message);
//     return jsonErr('Subscription streak is temporarily unavailable.', 503);
//   }
//   if (settingsResult.error) {
//     console.error('[customer/loyalty] settings read failed', settingsResult.error.message);
//     return jsonErr('Loyalty offers are temporarily unavailable.', 503);
//   }
//   if (balanceResult.error) {
//     console.error('[customer/loyalty] lifetime balance read failed', balanceResult.error.message);
//     return jsonErr('Loyalty balance is temporarily unavailable. Please retry shortly.', 503);
//   }

//   const events = eventsResult.error ? [] : eventsResult.data ?? [];
//   const streaks = streaksResult.error ? [] : streaksResult.data ?? [];
//   const settings = Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, row.value])) as Record<string, string>;
//   const pointsBalance = Number(balanceResult.data ?? 0);
//   const rewardTarget = Math.max(100, Number(settings.subscription_loyalty_points_per_reward ?? 300));
//   const remainder = ((pointsBalance % rewardTarget) + rewardTarget) % rewardTarget;
//   const enabled = settings.subscription_loyalty_enabled !== 'false';

//   return jsonOk({
//     points_balance: pointsBalance,
//     points_to_next_reward: pointsBalance >= rewardTarget && remainder === 0 ? 0 : Math.max(0, rewardTarget - remainder),
//     points_per_renewal: Number(settings.subscription_loyalty_points_per_renewal ?? 100),
//     streak_months: Number(settings.subscription_loyalty_streak_months ?? 3),
//     streak_bonus_points: Number(settings.subscription_loyalty_streak_bonus_points ?? 100),
//     enabled,
//     offers: {
//       free_can: enabled && settings.subscription_loyalty_free_can_enabled !== 'false',
//       service_discount: enabled && settings.subscription_loyalty_service_discount_enabled !== 'false',
//       plumbing: settings.subscription_loyalty_plumbing_enabled !== 'false',
//       tank_cleaning: settings.subscription_loyalty_tank_cleaning_enabled !== 'false',
//       points_per_rupee: Number(settings.subscription_loyalty_points_per_rupee ?? 1),
//       max_discount_percent: Number(settings.subscription_loyalty_max_discount_percent ?? 20),
//       points_per_reward: rewardTarget,
//     },
//     streaks,
//     events,
//     history_limit: 100,
//   });
// }
