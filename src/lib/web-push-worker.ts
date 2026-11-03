import 'server-only';
import { createServiceClient } from '@/utils/supabase/server';
import { pushConfigured, sendWebPush } from '@/lib/web-push-server';

type Delivery = {
  id: number; notification_id: string; subscription_id: string; attempts: number;
};
type Subscription = {
  id: string; user_id: string; endpoint: string; p256dh: string;
  auth_secret: string; enabled: boolean; revoked_at: string | null;
};
type Alert = {
  id: string; user_id: string; type: string; data: Record<string, unknown> | null;
};
type Preference = {
  user_id: string; push_enabled: boolean; marketing_enabled: boolean;
};
type Recipient = { id: string; role: string };

const retrySeconds = (attempts: number) =>
  Math.min(6 * 60 * 60, Math.round(40 * 2 ** Math.min(attempts, 8)));

function destination(role: string, alert: Alert) {
  if (role === 'supplier') return '/supplier/dashboard';
  if (role === 'technician' || role === 'plumber') return '/technician/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  const orderId = typeof alert.data?.order_id === 'string' && /^[0-9a-f-]{36}$/i.test(alert.data.order_id)
    ? alert.data.order_id : null;
  return orderId ? '/customer/track/' + orderId : '/customer/home';
}

/**
 * Low-cost, bounded worker. No long polling, duplicate order content or
 * third-party queue. The DB lease is safe across concurrent Vercel instances.
 * A failed fetch never alters booking/dispatch or financial state.
 */
export async function processDueWebPush(requested = 8) {
  if (!pushConfigured()) {
    return { enabled: false, claimed: 0, delivered: 0, failed: 0 };
  }
  const db = createServiceClient();
  const { data, error } = await db.rpc('claim_web_push_deliveries', {
    p_limit: Math.max(1, Math.min(8, requested)),
  });
  if (error) throw new Error('Unable to claim pending notification deliveries');
  const jobs = (data ?? []) as Delivery[];
  if (!jobs.length) return { enabled: true, claimed: 0, delivered: 0, failed: 0 };

  const [subscriptionsResult, notificationsResult] = await Promise.all([
    db.from('web_push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth_secret,enabled,revoked_at')
      .in('id', [...new Set(jobs.map(j => j.subscription_id))]),
    db.from('notifications')
      .select('id,user_id,type,data')
      .in('id', [...new Set(jobs.map(j => j.notification_id))]),
  ]);
  if (subscriptionsResult.error || notificationsResult.error)
    throw new Error('Notification delivery lookup unavailable; leases will expire');

  const subscriptions = new Map((subscriptionsResult.data ?? []).map(
    row => [row.id, row as Subscription],
  ));
  const notifications = new Map((notificationsResult.data ?? []).map(
    row => [row.id, row as Alert],
  ));
  const ids = [...new Set([...subscriptions.values()].map(s => s.user_id))];
  const [preferencesResult, profilesResult] = ids.length
    ? await Promise.all([
      db.from('web_push_preferences')
        .select('user_id,push_enabled,marketing_enabled').in('user_id', ids),
      db.from('profiles').select('id,role').in('id', ids),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (preferencesResult.error || profilesResult.error)
    throw new Error('Notification consent lookup unavailable; leases will expire');

  const preferences = new Map((preferencesResult.data ?? []).map(
    row => [row.user_id, row as Preference],
  ));
  const profiles = new Map((profilesResult.data ?? []).map(
    row => [row.id, row as Recipient],
  ));
  let delivered = 0;
  let failed = 0;

  const deliver = async (job: Delivery) => {
    const sub = subscriptions.get(job.subscription_id);
    const notification = notifications.get(job.notification_id);
    const prefs = sub && preferences.get(sub.user_id);
    const role = sub && profiles.get(sub.user_id)?.role;
    const authorized = Boolean(sub?.enabled && !sub.revoked_at && notification &&
      notification.user_id === sub.user_id && prefs?.push_enabled &&
      (notification.type !== 'promo' || prefs.marketing_enabled) && role);

    let outcome: 'revoked' | 'delivered' | 'retry' | 'failed' = 'revoked';
    let code = 'DISABLED_OR_MISSING';
    if (authorized && sub && notification && role) {
      const result = await sendWebPush(sub, {
        title: 'AuroTap update',
        body: 'You have a new update. Open AuroTap to see the details.',
        url: destination(role, notification),
        tag: 'aurotap-' + notification.id,
      });
      outcome = result.outcome;
      code = result.code;
    }
    const attempt = job.attempts + 1;
    if (outcome === 'delivered') delivered++;
    if (outcome === 'failed' || outcome === 'retry') failed++;
    const giveUp = attempt >= 6;
    const state = outcome === 'delivered' ? 'delivered'
      : outcome === 'revoked' ? 'revoked'
      : outcome === 'failed' || giveUp ? 'failed' : 'pending';
    const next = new Date(Date.now() + retrySeconds(attempt) * 1000).toISOString();
    const { error: updateError } = await db.from('web_push_deliveries')
      .update({
        state, attempts: attempt, leased_until: null,
        next_attempt_at: next, last_error_code: code.slice(0, 60),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id).eq('state', 'leased');
    if (updateError) console.error('[push] unable to persist delivery status', updateError.code);

    // Stale endpoints must not be retried; keep the device record for audit
    // until the user re-enables/re-registers explicitly.
    if (outcome === 'revoked' && sub?.enabled) {
      await db.from('web_push_subscriptions').update({
        enabled: false, revoked_at: new Date().toISOString(),
      }).eq('id', sub.id);
    }
  };
  for (let index = 0; index < jobs.length; index += 3) {
    await Promise.allSettled(jobs.slice(index, index + 3).map(deliver));
  }
  return { enabled: true, claimed: jobs.length, delivered, failed };
}
