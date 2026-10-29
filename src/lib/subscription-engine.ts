// src/lib/subscription-engine.ts
// The brain of recurring water deliveries.
//
// What makes it self-healing:
//  1. Idempotent  - running twice never creates a duplicate order.
//  2. Race-safe   - rows are claimed atomically (see sql/034).
//  3. Retries     - temporary errors retry later with growing delays.
//  4. Auto-pause  - permanent errors pause the plan and tell the customer why.
//  5. Auto-resume - plans paused by temporary outages restart on their own.
//  6. Catch-up    - after downtime we skip stale dates instead of flooding orders.
//  7. Re-dispatch - orders that found no supplier are offered again.

import { dispatchOrder } from '@/lib/dispatch';
import {
  addSubscriptionFrequency,
  scheduledAtIST,
} from '@/lib/subscription-schedule';
import {
  PermanentError,
  assertAdvances,
  daysBetween,
  num,
  orderTotal,
  rollForward,
} from '@/lib/subscription-math';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SubscriptionRow = Record<string, any>;

export const MAX_FAILURES = 5;
const GRACE_DAYS = 1;
const LOCK_MINUTES = 10;
const AUTO_RESUME_AFTER_HOURS = 6;
const MAX_AUTO_RESUMES = 2;
const BACKOFF_MINUTES = [5, 15, 60, 180, 720];

export type Outcome =
  | { kind: 'created'; orderId: string; dispatched: boolean }
  | { kind: 'existing'; orderId: string; dispatched: boolean }
  | { kind: 'customer_skipped' }
  | { kind: 'rolled_forward'; missed: number }
  | { kind: 'paused'; reason: string }
  | { kind: 'failed'; error: string; autoPaused: boolean };

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const minutesFromNow = (m: number) =>
  new Date(Date.now() + m * 60_000).toISOString();

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 300);

  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message).slice(0, 300);
  }

  return String(err).slice(0, 300);
}

async function notify(
  customerId: string,
  title: string,
  body: string,
  referenceId: string
) {
  try {
    const { createNotification } = await import('@/lib/notifications');

    await createNotification(
      customerId,
      title,
      body,
      'booking',
      referenceId,
      'created'
    );
  } catch {
    // A failed notification must never break subscription processing.
  }
}

async function tryDispatch(orderId: string): Promise<boolean> {
  try {
    const result = await dispatchOrder(orderId);
    return Boolean(result?.supplierId);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* State changes                                                       */
/* ------------------------------------------------------------------ */

/** Marks a successful run and moves the plan to its next delivery date. */
async function settle(
  db: Db,
  id: string,
  fromDate: string,
  toDate: string,
  lastOrderId: string | null,
  extra: Record<string, unknown> = {}
) {
  const patch: Record<string, unknown> = {
    next_order_date: toDate,
    locked_at: null,
    retry_after: null,
    consecutive_failures: 0,
    last_error: null,
    last_error_at: null,
    last_success_at: new Date().toISOString(),
    auto_resume_count: 0,
    ...extra,
  };

  if (lastOrderId) patch.last_order_id = lastOrderId;

  // The two .eq() guards stop us from overwriting a change the customer
  // made while we were working (for example, they paused the plan).
  const { error } = await db
    .from('water_subscriptions')
    .update(patch)
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .eq('next_order_date', fromDate);

  if (error) throw error;
}

async function pauseSubscription(
  db: Db,
  sub: SubscriptionRow,
  customerMessage: string,
  technical: string,
  kind: 'transient' | 'permanent'
): Promise<Outcome> {
  const id = String(sub.id);

  await db
    .from('water_subscriptions')
    .update({
      status: 'PAUSED',
      auto_paused: true,
      auto_pause_kind: kind,
      pause_reason: customerMessage,
      last_error: technical,
      last_error_at: new Date().toISOString(),
      locked_at: null,
      retry_after: null,
    })
    .eq('id', id);

  await notify(
    String(sub.customer_id),
    'Your water plan needs attention',
    customerMessage,
    id
  );

  return { kind: 'paused', reason: customerMessage };
}

async function recordFailure(
  db: Db,
  sub: SubscriptionRow,
  err: unknown
): Promise<Outcome> {
  const id = String(sub.id);
  const failures = num(sub.consecutive_failures) + 1;
  const message = errorMessage(err);
  const permanent = err instanceof PermanentError;

  if (permanent || failures >= MAX_FAILURES) {
    await pauseSubscription(
      db,
      sub,
      permanent
        ? 'We could not schedule your delivery because of a problem with this plan. Please review it and resume.'
        : 'We had trouble scheduling your delivery. We will try again automatically, and our team has been alerted.',
      message,
      permanent ? 'permanent' : 'transient'
    );

    await db
      .from('water_subscriptions')
      .update({ consecutive_failures: failures })
      .eq('id', id);

    return { kind: 'failed', error: message, autoPaused: true };
  }

  const delay =
    BACKOFF_MINUTES[Math.min(failures - 1, BACKOFF_MINUTES.length - 1)];

  await db
    .from('water_subscriptions')
    .update({
      consecutive_failures: failures,
      last_error: message,
      last_error_at: new Date().toISOString(),
      retry_after: minutesFromNow(delay),
      locked_at: null,
    })
    .eq('id', id);

  return { kind: 'failed', error: message, autoPaused: false };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

async function findOrder(db: Db, subscriptionId: string, scheduledAt: string) {
  const { data, error } = await db
    .from('orders')
    .select('id, status, supplier_id')
    .eq('subscription_id', subscriptionId)
    .eq('scheduled_at', scheduledAt)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as {
    id: string;
    status: string;
    supplier_id: string | null;
  } | null;
}

function buildOrderRow(
  sub: SubscriptionRow,
  address: Record<string, unknown>,
  nextDate: string,
  scheduledAt: string
) {
  const qty = Math.max(1, Math.floor(num(sub.quantity, 1)));
  const unit = Math.max(0, num(sub.price_per_can));
  const convenience = Math.max(0, num(sub.convenience_fee));
  const gstRate = Math.max(0, Math.min(1, num(sub.gst_rate)));
  const { base, gst, total } = orderTotal(qty, unit, convenience, gstRate);

  const a = address;

  const snapshot = {
    label: a.label ?? null,
    house_flat: a.house_flat ?? a.line1 ?? null,
    area: a.area ?? a.line2 ?? null,
    landmark: a.landmark ?? null,
    city: a.city ?? null,
    state: a.state ?? null,
    pincode: a.pincode ?? null,
    lat: a.lat ?? null,
    lng: a.lng ?? null,
  };

  const addressText = [
    a.house_flat ?? a.line1,
    a.area ?? a.line2,
    a.landmark,
    a.city,
    a.state,
    a.pincode,
  ]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(', ');

  const pricingExtras =
    sub.pricing_version !== undefined
      ? {
          pricing_version: sub.pricing_version ?? null,
          pricing_snapshot: {
            currency: 'INR',
            version: sub.pricing_version ?? null,
            source: sub.pricing_version
              ? 'versioned_subscription_contract'
              : 'legacy_subscription_contract',
            service_type: 'water_can',
            contract_snapshot:
              sub.pricing_snapshot && typeof sub.pricing_snapshot === 'object'
                ? sub.pricing_snapshot
                : null,
            quantity: qty,
            unit_price: unit,
            base_amount: base,
            convenience_fee: convenience,
            emergency_charge: 0,
            gst_rate: gstRate,
            gst_amount: gst,
            total_amount: total,
            supplier_entitlement: qty === 1 && total === 20 ? 20 : null,
            supplier_entitlement_policy:
              'existing_completion_policy_auto_posts_only_single_can_total_20; other_water_orders_require_approved_payout_schedule',
            scheduled_at: scheduledAt,
          },
        }
      : {};

  return {
    customer_id: sub.customer_id,
    service_type: 'water_can',
    status: 'PENDING',
    subscription_id: String(sub.id),
    can_count: qty,
    can_price_per_unit: unit,
    can_order_type: 'subscription',
    can_frequency: sub.frequency,
    total_amount: total,
    platform_fee: convenience,
    final_amount: total,
    base_amount: base,
    convenience_fee: convenience,
    emergency_charge: 0,
    gst_amount: gst,
    address_snapshot: snapshot,
    payment_status: 'unpaid',
    payment_method: sub.payment_method,
    address: addressText || null,
    address_id: sub.address_id,
    is_emergency: false,
    note: [
      'Subscription delivery',
      'Slot: ' + sub.preferred_time_slot,
      'Frequency: ' + sub.frequency,
    ].join(' | '),
    scheduled_date: nextDate,
    scheduled_at: scheduledAt,
    ...pricingExtras,
  };
}

/* ------------------------------------------------------------------ */
/* Main: process one subscription                                      */
/* ------------------------------------------------------------------ */

export async function processSubscription(
  db: Db,
  sub: SubscriptionRow,
  today: string
): Promise<Outcome> {
  const id = String(sub.id);
  const customerId = String(sub.customer_id);
  const nextDate = String(sub.next_order_date);

  try {
    // 1. Catch-up: we were down for days. Skip stale dates, tell the customer.
    if (daysBetween(today, nextDate) > GRACE_DAYS) {
      const { date, steps } = rollForward(nextDate, sub.frequency, today);

      await settle(db, id, nextDate, date, null);

      await notify(
        customerId,
        'Delivery plan updated',
        `We could not schedule your delivery on ${nextDate}. Your next delivery is on ${date}.`,
        id
      );

      return { kind: 'rolled_forward', missed: steps };
    }

    // 2. The customer asked to skip this delivery.
    if (sub.skip_next === true) {
      const future = addSubscriptionFrequency(nextDate, sub.frequency);
      assertAdvances(nextDate, future);

      await settle(db, id, nextDate, future, null, { skip_next: false });

      await notify(
        customerId,
        'Delivery skipped',
        `As you asked, we skipped your delivery on ${nextDate}. Next delivery: ${future}.`,
        id
      );

      return { kind: 'customer_skipped' };
    }

    // 3. Address must exist. We never guess a different address:
    //    delivering to the wrong door is worse than a paused plan.
    const { data: address, error: addressError } = await db
      .from('addresses')
      .select('*')
      .eq('id', sub.address_id)
      .maybeSingle();

    if (addressError) throw addressError;

    if (!address) {
      return await pauseSubscription(
        db,
        sub,
        'Your saved delivery address is no longer available. Please add an address and resume your plan.',
        'address_missing',
        'permanent'
      );
    }

    // 4. Find or create today's order (idempotent).
    const scheduledAt = scheduledAtIST(
      nextDate,
      String(sub.preferred_start_time ?? '').slice(0, 5) || '09:00'
    );

    let order = await findOrder(db, id, scheduledAt);
    let created = false;

    if (!order) {
      const inserted = await db
        .from('orders')
        .insert(
          buildOrderRow(
            sub,
            address as Record<string, unknown>,
            nextDate,
            scheduledAt
          )
        )
        .select('id, status, supplier_id')
        .single();

      if (inserted.error) {
        // 23505 = another run created it first. That is fine - use theirs.
        if (inserted.error.code === '23505') {
          order = await findOrder(db, id, scheduledAt);
        } else {
          throw inserted.error;
        }
      } else {
        order = inserted.data;
        created = true;
      }

      if (!order) throw new Error('Order could not be created');
    }

    const orderId = String(order.id);

    if (created) {
      await notify(
        customerId,
        'Next delivery scheduled',
        `Your subscription delivery is scheduled for ${nextDate} · ${sub.preferred_time_slot}.`,
        orderId
      );
    }

    // 5. Offer the job to suppliers. A failure here is healed by the sweep.
    let dispatched = false;

    if (!order.supplier_id && String(order.status) === 'PENDING') {
      dispatched = await tryDispatch(orderId);
    }

    // 6. Move the plan to its next date.
    const future = addSubscriptionFrequency(nextDate, sub.frequency);
    assertAdvances(nextDate, future);

    await settle(db, id, nextDate, future, orderId);

    return created
      ? { kind: 'created', orderId, dispatched }
      : { kind: 'existing', orderId, dispatched };
  } catch (err) {
    return recordFailure(db, sub, err);
  }
}

/* ------------------------------------------------------------------ */
/* Claiming + healing sweeps                                           */
/* ------------------------------------------------------------------ */

export async function claimDueSubscriptions(
  db: Db,
  today: string,
  limit = 100
): Promise<SubscriptionRow[]> {
  const { data, error } = await db.rpc('claim_due_subscriptions', {
    p_today: today,
    p_limit: limit,
  });

  if (!error && Array.isArray(data)) return data;

  // Fallback if sql/034 has not been applied yet: works, but without locking.
  console.warn(
    '[subscription-engine] claim_due_subscriptions unavailable, using fallback:',
    error?.message
  );

  const legacy = await db
    .from('water_subscriptions')
    .select('*')
    .eq('status', 'ACTIVE')
    .lte('next_order_date', today)
    .order('next_order_date', { ascending: true })
    .limit(limit);

  if (legacy.error) throw legacy.error;
  return legacy.data ?? [];
}

/** A crashed run leaves rows locked. Free them. */
export async function releaseStaleLocks(db: Db): Promise<number> {
  try {
    const { data } = await db
      .from('water_subscriptions')
      .update({ locked_at: null })
      .lt('locked_at', minutesFromNow(-LOCK_MINUTES))
      .select('id');

    return data?.length ?? 0;
  } catch {
    return 0;
  }
}

/** Plans paused by a temporary outage restart by themselves (max 2 times). */
export async function autoResumeTransientPauses(db: Db): Promise<number> {
  try {
    const { data } = await db
      .from('water_subscriptions')
      .select('id, auto_resume_count')
      .eq('status', 'PAUSED')
      .eq('auto_paused', true)
      .eq('auto_pause_kind', 'transient')
      .lte('last_error_at', hoursAgo(AUTO_RESUME_AFTER_HOURS))
      .limit(50);

    let resumed = 0;

    for (const row of data ?? []) {
      const count = num(row.auto_resume_count);
      if (count >= MAX_AUTO_RESUMES) continue;

      const { error } = await db
        .from('water_subscriptions')
        .update({
          status: 'ACTIVE',
          auto_paused: false,
          auto_pause_kind: null,
          pause_reason: null,
          consecutive_failures: 0,
          retry_after: null,
          locked_at: null,
          auto_resume_count: count + 1,
        })
        .eq('id', row.id)
        .eq('status', 'PAUSED');

      if (!error) resumed += 1;
    }

    return resumed;
  } catch {
    return 0;
  }
}

/** Orders that found no supplier get offered again for the last 2 days. */
export async function redispatchUnassigned(
  db: Db,
  today: string
): Promise<number> {
  try {
    const since = new Date(Date.parse(`${today}T00:00:00Z`) - 2 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const { data } = await db
      .from('orders')
      .select('id')
      .eq('can_order_type', 'subscription')
      .eq('status', 'PENDING')
      .is('supplier_id', null)
      .gte('scheduled_date', since)
      .lte('scheduled_date', today)
      .limit(50);

    let healed = 0;

    for (const row of data ?? []) {
      if (await tryDispatch(String(row.id))) healed += 1;
    }

    return healed;
  } catch {
    return 0;
  }
}
