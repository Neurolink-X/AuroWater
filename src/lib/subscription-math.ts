// src/lib/subscription-math.ts
// Pure helpers (no database, no network). Safe to import from API routes and tests.

import {
  addSubscriptionFrequency,
  isSubscriptionFrequency,
  type SubscriptionFrequency,
} from '@/lib/subscription-schedule';

/** An error that retrying will never fix (bad frequency, missing address...). */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

export function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function orderTotal(
  quantity: number,
  pricePerCan: number,
  convenience: number,
  gstRate: number
) {
  const base = Math.round(quantity * pricePerCan * 100) / 100;
  const subtotal = base + convenience;
  const gst = Math.round(subtotal * gstRate);

  return { base, gst, total: subtotal + gst };
}

/** a - b in whole days. Both values are 'YYYY-MM-DD'. */
export function daysBetween(a: string, b: string): number {
  const ms =
    Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Guards against an unknown frequency that would loop forever. */
export function assertAdvances(from: string, to: string): void {
  if (!(to > from)) {
    throw new PermanentError('Delivery frequency is not valid');
  }
}

/**
 * Moves a missed date forward until it is today or later.
 * Example: server was down for 5 days -> we do NOT create 5 stale orders,
 * we jump to the next real delivery day.
 */
export function rollForward(
  date: string,
  frequency: string,
  today: string
): { date: string; steps: number } {
  if (!isSubscriptionFrequency(frequency)) {
    throw new PermanentError('Delivery frequency is not valid');
  }

  const validFrequency: SubscriptionFrequency = frequency;
  let current = date;
  let steps = 0;

  while (current < today) {
    const next = addSubscriptionFrequency(current, validFrequency);
    assertAdvances(current, next);
    current = next;
    steps += 1;

    if (steps > 400) {
      throw new PermanentError('Schedule is too far behind to recover');
    }
  }

  return { date: current, steps };
}

/** The next few delivery dates a customer will see. Never throws. */
export function upcomingDates(
  next: string,
  frequency: string,
  today: string,
  count = 3
): string[] {
  if (!isSubscriptionFrequency(frequency)) return [next];
  const validFrequency: SubscriptionFrequency = frequency;

  try {
    let { date } = rollForward(next, validFrequency, today);
    const out = [date];

    while (out.length < count) {
      const following = addSubscriptionFrequency(date, validFrequency);
      assertAdvances(date, following);
      out.push(following);
      date = following;
    }

    return out;
  } catch {
    return [next];
  }
}
