/**
 * Server-side notification inserts for order lifecycle events.
 * Uses the service-role client so inserts succeed from API routes that
 * authenticate via Bearer JWT (RLS bypass on insert).
 */
import { createServiceClient } from '@/utils/supabase/server';

export type NotificationType = 'booking' | 'payment' | 'system' | 'promo';

/** Matches `dedup_key`: order_<uuid>_<event_type> */
export type OrderNotificationEventType =
  | 'created'
  | 'cancelled'
  | 'assigned'
  | 'status_changed'
  | 'completed';

interface NotificationInsertRow {
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  order_id: string;
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
  const dedup_key = `order_${orderId}_${eventType}`;

  try {
    const sb = createServiceClient();
    const payload: NotificationInsertRow = {
      user_id: userId,
      title,
      body,
      type,
      order_id: orderId,
      is_read: false,
      dedup_key,
    };

    const { error } = await sb.from('notifications').insert(payload);
    if (error && error.code === '23505') {
      return;
    }
    if (error) {
      console.error('[createNotification]', error.message);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[createNotification]', msg);
  }
}
