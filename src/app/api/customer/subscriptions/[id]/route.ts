import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import {
  addDays,
  addSubscriptionFrequency,
  scheduledAtIST,
} from '@/lib/subscription-schedule';

type Ctx = {
  params: Promise<{
    id: string;
  }>;
};

function todayIST(): string {
  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).format(new Date());
}

export async function PATCH(
  req: NextRequest,
  { params }: Ctx
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (
    !requireRole(
      auth.ctx,
      'customer'
    )
  ) {
    return jsonErr(
      'Forbidden',
      403
    );
  }

  const { id } =
    await params;

  if (!id) {
    return jsonErr(
      'Subscription ID is required',
      400
    );
  }

  let body:
    Record<string, unknown>;

  try {
    body =
      (await req.json()) as Record<
        string,
        unknown
      >;
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400
    );
  }

  const action =
    String(
      body.action ?? ''
    ).toLowerCase();

  if (
    ![
      'pause',
      'resume',
      'cancel',
    ].includes(action)
  ) {
    return jsonErr(
      'Unsupported subscription action',
      400
    );
  }

  const admin =
    createServiceClient();

  const {
    data: subscription,
    error: readError,
  } =
    await admin
      .from(
        'water_subscriptions'
      )
      .select('*')
      .eq(
        'id',
        id
      )
      .eq(
        'customer_id',
        auth.ctx.profile.id
      )
      .maybeSingle();

  if (
    readError ||
    !subscription
  ) {
    return jsonErr(
      'Subscription not found',
      404
    );
  }

  const currentStatus =
    String(
      subscription.status
    ).toUpperCase();

  if (
    action === 'pause' &&
    currentStatus !== 'ACTIVE'
  ) {
    return jsonErr(
      'Only an active subscription can be paused',
      400
    );
  }

  if (
    action === 'cancel' &&
    currentStatus === 'CANCELLED'
  ) {
    return jsonOk(
      subscription
    );
  }

  if (
    action === 'resume' &&
    currentStatus !== 'PAUSED'
  ) {
    return jsonErr(
      'Only a paused subscription can be resumed',
      400
    );
  }

  if (
    action === 'pause' ||
    action === 'cancel'
  ) {
    const nextStatus =
      action === 'pause'
        ? 'PAUSED'
        : 'CANCELLED';

    const pauseReason =
      typeof body.reason ===
      'string'
        ? body.reason
            .trim()
            .slice(0, 200)
        : action === 'pause'
          ? 'Paused by customer'
          : 'Cancelled by customer';

    const {
      data: updated,
      error: updateError,
    } =
      await admin
        .from(
          'water_subscriptions'
        )
        .update({
          status:
            nextStatus,
          pause_reason:
            pauseReason,
          ...(action === 'cancel'
            ? {
                cancelled_at:
                  new Date().toISOString(),
              }
            : {}),
        })
        .eq(
          'id',
          id
        )
        .eq(
          'customer_id',
          auth.ctx.profile.id
        )
        .select('*')
        .single();

    if (
      updateError ||
      !updated
    ) {
      return jsonErr(
        'Unable to update your subscription right now',
        500
      );
    }

    // Cancel future, not-yet-accepted deliveries. Completed or in-progress
    // orders are never touched.
    await admin
      .from('orders')
      .update({
        status:
          'CANCELLED',
        cancel_reason:
          nextStatus === 'CANCELLED'
            ? 'Subscription cancelled by customer'
            : 'Subscription paused by customer',
        cancelled_at:
          new Date().toISOString(),
      })
      .eq(
        'subscription_id',
        id
      )
      .gte(
        'scheduled_at',
        new Date().toISOString()
      )
      .in(
        'status',
        [
          'PENDING',
          'ASSIGNED',
        ]
      )
      .is(
        'accepted_at',
        null
      );

    return jsonOk(
      updated
    );
  }

  // Resume: create a new next delivery at least one day ahead.
  const today =
    todayIST();

  let nextDate =
    String(
      subscription.next_order_date
    );

  if (
    nextDate <= today
  ) {
    nextDate =
      addDays(
        today,
        1
      );
  }

  const start =
    String(
      subscription.preferred_start_time
    ).slice(0, 5);

  const end =
    String(
      subscription.preferred_end_time
    ).slice(0, 5);

  const frequency =
    String(
      subscription.frequency
    );

  const nextScheduledAt =
    scheduledAtIST(
      nextDate,
      start
    );

  const {
    data: existing,
  } =
    await admin
      .from('orders')
      .select('id')
      .eq(
        'subscription_id',
        id
      )
      .eq(
        'scheduled_at',
        nextScheduledAt
      )
      .maybeSingle();

  if (!existing) {
    const qty =
      Number(
        subscription.quantity
      );

    const unit =
      Number(
        subscription.price_per_can
      );

    const convenience =
      Number(
        subscription.convenience_fee
      ) || 0;

    const gstRate =
      Number(
        subscription.gst_rate
      ) || 0;

    const base =
      Math.round(
        qty * unit * 100
      ) / 100;

    const gst =
      Math.round(
        (base + convenience) *
          gstRate
      );

    const total =
      base +
      convenience +
      gst;

    const {
      data: address,
    } =
      await admin
        .from('addresses')
        .select('*')
        .eq(
          'id',
          subscription.address_id
        )
        .maybeSingle();

    if (!address) {
      return jsonErr(
        'Your saved delivery address is no longer available. Please contact support before resuming.',
        400
      );
    }

    const a =
      address as Record<
        string,
        unknown
      >;

    const addressSnapshot = {
      label:
        a.label ?? null,
      house_flat:
        a.house_flat ??
        a.line1 ??
        null,
      area:
        a.area ??
        a.line2 ??
        null,
      landmark:
        a.landmark ??
        null,
      city:
        a.city ??
        null,
      state:
        a.state ??
        null,
      pincode:
        a.pincode ??
        null,
      lat:
        a.lat ??
        null,
      lng:
        a.lng ??
        null,
    };

    const addressText = [
      a.house_flat ??
        a.line1,
      a.area ??
        a.line2,
      a.landmark,
      a.city,
      a.state,
      a.pincode,
    ]
      .filter(
        (value) =>
          typeof value ===
            'string' &&
          value.trim()
      )
      .join(', ');

    const {
      error: orderError,
    } =
      await admin
        .from('orders')
        .insert({
          customer_id:
            auth.ctx.profile.id,
          service_type:
            'water_can',
          status:
            'PENDING',
          subscription_id:
            id,
          can_count:
            qty,
          can_price_per_unit:
            unit,
          can_order_type:
            'subscription',
          can_frequency:
            frequency,
          total_amount:
            total,
          platform_fee:
            convenience,
          final_amount:
            total,
          base_amount:
            base,
          convenience_fee:
            convenience,
          emergency_charge:
            0,
          gst_amount:
            gst,
          address_snapshot:
            addressSnapshot,
          payment_status:
            'pending',
          payment_method:
            subscription.payment_method,
          address:
            addressText ||
            null,
          address_id:
            subscription.address_id,
          is_emergency:
            false,
          note:
            [
              'Subscription delivery',
              'Slot: ' +
                subscription.preferred_time_slot,
              'Frequency: ' +
                frequency,
            ].join(' | '),
          scheduled_date:
            nextDate,
          scheduled_at:
            nextScheduledAt,
        });

    if (
      orderError
    ) {
      return jsonErr(
        'Unable to create the next subscription delivery right now',
        500
      );
    }
  }

  const {
    data: updated,
    error: updateError,
  } =
    await admin
      .from(
        'water_subscriptions'
      )
      .update({
        status:
          'ACTIVE',
        pause_reason:
          null,
        next_order_date:
          nextDate,
      })
      .eq(
        'id',
        id
      )
      .eq(
        'customer_id',
        auth.ctx.profile.id
      )
      .select('*')
      .single();

  if (
    updateError ||
    !updated
  ) {
    return jsonErr(
      'Unable to resume your subscription right now',
      500
    );
  }

  return jsonOk(
    updated
  );
}
