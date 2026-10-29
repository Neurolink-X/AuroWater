/**
 * Shared, pure loyalty helpers (safe on server and client, easy to unit-test).
 */

export type LoyaltyEvent = {
  id: string;
  subscription_id?: string | null;
  order_id?: string | null;
  event_type: string;
  points_delta: number;
  description: string;
  created_at: string;
};

export type LoyaltyStreak = {
  subscription_id: string;
  last_renewal_month: string | null;
  consecutive_months: number;
  /** Renewals still needed for the next streak bonus. 0 = bonus just earned. */
  bonus_in: number;
};

export type LoyaltyData = {
  status: 'ok' | 'degraded';
  degraded: string[];
  points_balance: number;
  points_to_next_reward: number;
  rewards_available: number;
  progress_percent: number;
  points_per_renewal: number;
  streak_months: number;
  streak_bonus_points: number;
  enabled: boolean;
  offers: {
    free_can: boolean;
    service_discount: boolean;
    plumbing: boolean;
    tank_cleaning: boolean;
    points_per_rupee: number;
    max_discount_percent: number;
    points_per_reward: number;
  };
  streaks: LoyaltyStreak[];
  events: LoyaltyEvent[];
  has_more: boolean;
  next_cursor: string | null;
  request_id?: string;
};

type DbError = { code?: string; message?: string } | null | undefined;

/** Safe number parsing: null / '' / NaN fall back, result is clamped. */
export function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Settings flag: anything except an explicit "off" value is on. */
export function flag(value: unknown, fallback = true): boolean {
  if (value === null || value === undefined) return fallback;
  return !['false', '0', 'off', 'no'].includes(String(value).trim().toLowerCase());
}

export function rewardProgress(balance: number, target: number) {
  const safeTarget = Math.max(1, Math.floor(target));
  const safeBalance = Math.max(0, Math.floor(balance));
  const rewardsAvailable = Math.floor(safeBalance / safeTarget);
  const remainder = safeBalance % safeTarget;
  const atMilestone = rewardsAvailable > 0 && remainder === 0;
  return {
    rewardsAvailable,
    pointsToNext: atMilestone ? 0 : safeTarget - remainder,
    percent: atMilestone ? 100 : Math.round((remainder / safeTarget) * 100),
  };
}

export function streakBonusIn(consecutive: number, streakMonths: number): number {
  const span = Math.max(1, Math.floor(streakMonths));
  if (consecutive <= 0) return span;
  const r = consecutive % span;
  return r === 0 ? 0 : span - r;
}

export const isMissingTable = (error: DbError) =>
  Boolean(error && ['42P01', 'PGRST205'].includes(String(error.code ?? '')));

/** Errors worth retrying: connection, timeout, resource, PostgREST availability. */
export function isTransient(error: DbError): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  if (/^(08|53|57)/.test(code) || ['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003'].includes(code)) return true;
  return !code && /fetch|network|timeout|econn|socket/i.test(String(error.message ?? ''));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries a Supabase call on transient errors with exponential backoff and jitter. */
export async function withRetry<T extends { error?: DbError }>(
  fn: () => PromiseLike<T>,
  retries = 2,
  baseMs = 120,
): Promise<T> {
  let last = undefined as unknown as T;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      last = await fn();
      if (!last.error || !isTransient(last.error)) return last;
    } catch (e) {
      last = { error: { message: e instanceof Error ? e.message : String(e) } } as T;
      if (!isTransient(last.error)) return last;
    }
    if (attempt < retries) await sleep(baseMs * 2 ** attempt + Math.random() * 60);
  }
  return last;
}

/** Defensive parser: tolerates older API versions and malformed payloads. */
export function parseLoyaltyPayload(raw: unknown): LoyaltyData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.points_balance !== 'number' || !Number.isFinite(r.points_balance)) return null;

  const o = (r.offers && typeof r.offers === 'object' ? r.offers : {}) as Record<string, unknown>;
  const streakMonths = Math.max(1, Math.trunc(num(r.streak_months, 3, 1, 24)));
  const target = Math.max(1, num(o.points_per_reward, 300, 1));
  const progress = rewardProgress(r.points_balance, target);

  const events = (Array.isArray(r.events) ? r.events : [])
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object' && typeof (e as Record<string, unknown>).id === 'string')
    .map((e) => ({
      id: String(e.id),
      subscription_id: (e.subscription_id as string | null) ?? null,
      order_id: (e.order_id as string | null) ?? null,
      event_type: String(e.event_type ?? 'activity'),
      points_delta: num(e.points_delta, 0),
      description: String(e.description ?? ''),
      created_at: String(e.created_at ?? ''),
    }));

  const streaks = (Array.isArray(r.streaks) ? r.streaks : [])
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object' && typeof (s as Record<string, unknown>).subscription_id === 'string')
    .map((s) => {
      const consecutive = Math.max(0, Math.trunc(num(s.consecutive_months, 0)));
      return {
        subscription_id: String(s.subscription_id),
        last_renewal_month: (s.last_renewal_month as string | null) ?? null,
        consecutive_months: consecutive,
        bonus_in: num(s.bonus_in, streakBonusIn(consecutive, streakMonths), 0),
      };
    });

  return {
    status: r.status === 'degraded' ? 'degraded' : 'ok',
    degraded: Array.isArray(r.degraded) ? r.degraded.map(String) : [],
    points_balance: Math.max(0, r.points_balance),
    points_to_next_reward: num(r.points_to_next_reward, progress.pointsToNext, 0),
    rewards_available: num(r.rewards_available, progress.rewardsAvailable, 0),
    progress_percent: num(r.progress_percent, progress.percent, 0, 100),
    points_per_renewal: num(r.points_per_renewal, 100, 0),
    streak_months: streakMonths,
    streak_bonus_points: num(r.streak_bonus_points, 100, 0),
    enabled: r.enabled !== false,
    offers: {
      free_can: o.free_can === true,
      service_discount: o.service_discount === true,
      plumbing: o.plumbing !== false,
      tank_cleaning: o.tank_cleaning !== false,
      points_per_rupee: num(o.points_per_rupee, 1, 0),
      max_discount_percent: num(o.max_discount_percent, 20, 0, 100),
      points_per_reward: target,
    },
    streaks,
    events,
    has_more: r.has_more === true,
    next_cursor: typeof r.next_cursor === 'string' ? r.next_cursor : null,
    request_id: typeof r.request_id === 'string' ? r.request_id : undefined,
  };
}
