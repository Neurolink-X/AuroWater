/**
 * Server-side notification inserts for order lifecycle events.
 * Uses the service-role client so inserts succeed from API routes that
 * authenticate via Bearer JWT (no cookie session for RLS-as-user).
 */
import { createServiceClient } from '@/utils/supabase/server';

export type NotificationType = 'booking' | 'payment' | 'system' | 'promo';

/** Suffix for `dedup_key` = `order_${order_id}_${segment}` — idempotent per order event */
export type OrderNotificationDedupSegment =
  | 'created'
  | 'cancelled'
  | 'assigned'
  | 'status_changed_in_progress'
  | 'status_changed_completed'
  | 'status_changed_cancelled';

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: NotificationType = 'booking',
  orderId?: string,
  orderDedupSegment?: OrderNotificationDedupSegment
): Promise<void> {
  const dedup_key =
    orderId && orderDedupSegment ? `order_${orderId}_${orderDedupSegment}` : undefined;

  try {
    const sb = createServiceClient();
    const payload: {
      user_id: string;
      title: string;
      body: string;
      type: NotificationType;
      order_id: string | null;
      is_read: boolean;
      dedup_key?: string;
    } = {
      user_id: userId,
      title,
      body,
      type,
      order_id: orderId ?? null,
      is_read: false,
    };
    if (dedup_key) {
      payload.dedup_key = dedup_key;
    }

    const { error } = await sb.from('notifications').insert(payload);
    if (error && error.code === '23505') {
      return;
    }
    if (error) {
      throw error;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[createNotification]', msg);
  }
}
