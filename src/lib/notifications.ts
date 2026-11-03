/**
 * Server-side notification inserts for order lifecycle events.
 * Uses the service-role client so inserts succeed from API routes that
 * authenticate via Bearer JWT (RLS bypass on insert).
 */
import { createServiceClient } from '@/utils/supabase/server';
import { after } from 'next/server';

export type NotificationType = 'booking' | 'payment' | 'system' | 'promo';

/** Matches `dedup_key`: order_<uuid>_<event_type> */
export type OrderNotificationEventType =
  | 'created'
  | 'cancelled'
  | 'assigned'
  | 'status_changed'
  | 'completed'
  | 'technician_accepted'
  | 'technician_started'
  | 'technician_cancelled';

interface NotificationInsertRow {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  data: { order_id: string };
  is_read: boolean;
  dedup_key: string;
}

/**
 * Idempotent per (user, dedup_key) — see unique index on notifications.
 * Never throws: failures are logged only.
 */
export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: NotificationType,
  orderId: string,
  eventType: OrderNotificationEventType
): Promise<void> {
  // dedup_key is unique globally; recipient ID is essential for multi-partner offers.
  const dedup_key = `order_${orderId}_${eventType}_${userId}`;

  try {
    const sb = createServiceClient();
    const payload: NotificationInsertRow = {
      user_id: userId,
      title,
      message: body,
      type,
      data: { order_id: orderId },
      is_read: false,
      dedup_key,
    };

    const { error } = await sb.from('notifications').insert(payload);
    if (error && error.code === '23505') {
      return;
    }
    if (error) {
      console.error('[createNotification]', error.code);
      return;
    }
    // Deliver after the HTTP response so push encryption and network latency
    // never block booking/dispatch. pg_cron separately recovers failed attempts.
    try {
      after(async () => {
        try {
          const { processDueWebPush } = await import('@/lib/web-push-worker');
          await processDueWebPush(4);
        } catch {
          // The persisted outbox is recovered by the scheduled push worker.
        }
      });
    } catch {
      // Other invocation contexts have no after-response hook; cron handles it.
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[createNotification]', msg);
  }
}
