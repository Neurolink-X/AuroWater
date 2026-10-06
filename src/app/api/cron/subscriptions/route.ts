import { NextRequest } from 'next/server';

import { createServiceClient } from '@/utils/supabase/server';
import { dispatchOrder } from '@/lib/dispatch';
import {
  addDays,
  addSubscriptionFrequency,
  scheduledAtIST,
  todayIST,
} from '@/lib/subscription-schedule';

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return Response.json(
    body,
    {
      status,
      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  );
}

function isAuthorized(
  req: NextRequest
): boolean {
  const secret =
    process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const auth =
    req.headers.get(
      'authorization'
    );

  return (
    auth ===
    `Bearer ${secret}`
  );
}

function number(
  value: unknown,
  fallback = 0
): number {
  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}

function orderTotal(
  quantity: number,
  pricePerCan: number,
  convenience: number,
  gstRate: number
) {
  const base =
    Math.round(
      quantity *
        pricePerCan *
        100
    ) / 100;

  const subtotal =
    base +
    convenience;

  const gst =
    Math.round(
      subtotal *
        gstRate
    );

  return {
    base,
    gst,
    total:
      subtotal + gst,
  };
}

async function notifyCustomer(
  db: any,
  customerId: string,
  title: string,
  body: string,
  orderId: string
) {
  try {
    const {
      createNotification,
    } = await import(
      '@/lib/notifications'
    );

    await createNotification(
      customerId,
      title,
      body,
      'booking',
      orderId,
      'subscription'
    );
  } catch {
    // Notification failure must never break subscription processing.
  }
}

export async function GET(
  req: NextRequest
) {
  if (!isAuthorized(req)) {
    return json(
      {
        ok: false,
        error:
          'Unauthorized',
      },
      401
    );
  }

  const db =
    createServiceClient();

  const today =
    todayIST();

  // Generate and/or dispatch deliveries that are due today or tomorrow.
  // The scheduler intentionally prepares the next delivery one day ahead
  // so the supplier-dispatch workflow can run before the delivery window.
  const tomorrow =
    addDays(
      today,
      1
    );

  const {
    data: subscriptions,
    error,
  } =
    await db
      .from(
        'water_subscriptions'
      )
      .select('*')
      .eq(
        'status',
        'ACTIVE'
      )
      .lte(
        'next_order_date',
        tomorrow
      )
      .order(
        'next_order_date',
        {
          ascending: true,
        }
      )
      .limit(100);

  if (error) {
    return json(
      {
        ok: false,
        error:
          'Subscription query failed',
      },
      500
    );
  }

  let processed = 0;
  let created = 0;
  let dispatched = 0;
  let skipped = 0;
  let paused = 0;

  for (const subscription of
    subscriptions ?? []) {
    const subscriptionId =
      String(
        subscription.id
      );

    try {
      const nextDate =
        String(
          subscription.next_order_date
        );

      const {
        data: address,
      } =
        await db
          .from(
            'addresses'
          )
          .select('*')
          .eq(
            'id',
            subscription.address_id
          )
          .maybeSingle();

      if (!address) {
        await db
          .from(
            'water_subscriptions'
          )
          .update({
            status:
              'PAUSED',
            pause_reason:
              'Saved delivery address is no longer available',
          })
          .eq(
            'id',
            subscriptionId
          );

        paused += 1;
        continue;
      }

      const qty =
        Math.max(
          1,
          Math.floor(
            number(
              subscription.quantity,
              1
            )
          )
        );

      const unit =
        Math.max(
          0,
          number(
            subscription.price_per_can
          )
        );

      const convenience =
        Math.max(
          0,
          number(
            subscription.convenience_fee
          )
        );

      const gstRate =
        Math.max(
          0,
          Math.min(
            1,
            number(
              subscription.gst_rate
            )
          )
        );

      const start =
        String(
          subscription.preferred_start_time
        ).slice(0, 5);

      const scheduledAt =
        scheduledAtIST(
          nextDate,
          start
        );

      const {
        data: existing,
      } =
        await db
          .from('orders')
          .select(
            'id, status, supplier_id'
          )
          .eq(
            'subscription_id',
            subscriptionId
          )
          .eq(
            'scheduled_at',
            scheduledAt
          )
          .maybeSingle();

      let orderId =
        existing?.id
          ? String(
              existing.id
            )
          : null;

      if (!orderId) {
        const {
          base,
          gst,
          total,
        } =
          orderTotal(
            qty,
            unit,
            convenience,
            gstRate
          );

        const a =
          address as Record<
            string,
            unknown
          >;

        const snapshot = {
          label:
            a.label ??
            null,
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
          data: order,
          error:
            orderError,
        } =
          await db
            .from('orders')
            .insert({
              customer_id:
                subscription.customer_id,
              service_type:
                'water_can',
              status:
                'PENDING',
              subscription_id:
                subscriptionId,
              can_count:
                qty,
              can_price_per_unit:
                unit,
              can_order_type:
                'subscription',
              can_frequency:
                subscription.frequency,
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
                snapshot,
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
                    subscription.frequency,
                ].join(' | '),
              scheduled_date:
                nextDate,
              scheduled_at:
                scheduledAt,
            })
            .select('id')
            .single();

        if (
          orderError ||
          !order
        ) {
          skipped += 1;
          continue;
        }

        orderId =
          String(
            order.id
          );

        created += 1;

        await notifyCustomer(
          db,
          String(
            subscription.customer_id
          ),
          'Next delivery scheduled',
          `Your subscription delivery is scheduled for ${nextDate} · ${subscription.preferred_time_slot}.`,
          orderId
        );
      }

      if (
        orderId &&
        nextDate <= tomorrow
      ) {
        const result =
          await dispatchOrder(
            orderId
          );

        if (
          result.supplierId
        ) {
          dispatched += 1;
        }
      }

      const futureDate =
        addSubscriptionFrequency(
          nextDate,
          subscription.frequency
        );

      await db
        .from(
          'water_subscriptions'
        )
        .update({
          next_order_date:
            futureDate,
          last_order_id:
            orderId,
        })
        .eq(
          'id',
          subscriptionId
        )
        .eq(
          'status',
          'ACTIVE'
        );

      processed += 1;
    } catch {
      skipped += 1;
    }
  }

  return json({
    ok: true,
    date: today,
    summary: {
      found:
        subscriptions?.length ??
        0,
      processed,
      created,
      dispatched,
      skipped,
      paused,
    },
  });
}
