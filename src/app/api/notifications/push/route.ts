import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { pushConfigured } from '@/lib/web-push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = <T extends Response>(r: T): T => {
  r.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return r;
};

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{70,120}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,70}$/),
  }),
});
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('subscribe'), subscription: subscriptionSchema }),
  z.object({ action: z.literal('disable') }),
  z.object({ action: z.literal('marketing'), enabled: z.boolean() }),
]);
function eligibleEndpoint(raw: string) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.port && !url.hash && (
        ['fcm.googleapis.com', 'updates.push.services.mozilla.com',
          'web.push.apple.com'].includes(host) ||
        /^wns[0-9]*\.notify\.windows\.com$/.test(host)
      );
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const db = createServiceClient();
  const id = auth.ctx.profile.id;
  const [pref, devices] = await Promise.all([
    db.from('web_push_preferences').select('push_enabled,marketing_enabled')
      .eq('user_id', id).maybeSingle(),
    db.from('web_push_subscriptions').select('id', { count: 'exact', head: true })
      .eq('user_id', id).eq('enabled', true),
  ]);
  if (pref.error || devices.error)
    return noStore(jsonErr('Notification preferences could not be loaded', 503));
  return noStore(jsonOk({
    configured: pushConfigured(),
    vapid_public_key: pushConfigured() ? process.env.WEB_PUSH_VAPID_PUBLIC_KEY : null,
    enabled: pref.data?.push_enabled === true,
    marketing: pref.data?.marketing_enabled === true,
    devices: devices.count ?? 0,
  }));
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const text = await req.text();
  if (text.length > 4000) return noStore(jsonErr('Request too large', 413));
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(JSON.parse(text));
  } catch {
    return noStore(jsonErr('Invalid notification settings', 400));
  }
  const db = createServiceClient();
  const userId = auth.ctx.profile.id;

  if (parsed.action === 'disable') {
    const result = await db.from('web_push_preferences')
      .upsert({ user_id: userId, push_enabled: false, marketing_enabled: false,
        updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (result.error) return noStore(jsonErr('Could not disable alerts', 503));
    const { data: subs, error: lookupError } = await db.from('web_push_subscriptions')
      .select('id').eq('user_id', userId).eq('enabled', true).limit(20);
    if (lookupError) return noStore(jsonErr('Alerts disabled; device cleanup pending', 503));
    if (subs?.length) {
      const ids = subs.map(s => s.id);
      await Promise.all([
        db.from('web_push_subscriptions').update({
          enabled: false, revoked_at: new Date().toISOString(),
        }).in('id', ids),
        db.from('web_push_deliveries').update({
          state: 'revoked', leased_until: null, updated_at: new Date().toISOString(),
        }).in('subscription_id', ids).in('state', ['pending', 'leased']),
      ]);
    }
    return noStore(jsonOk({ enabled: false }));
  }

  if (parsed.action === 'marketing') {
    const { data: old, error: oldError } = await db.from('web_push_preferences')
      .select('push_enabled').eq('user_id', userId).maybeSingle();
    if (oldError) return noStore(jsonErr('Preferences unavailable', 503));
    const { error } = await db.from('web_push_preferences').upsert({
      user_id: userId,
      push_enabled: old?.push_enabled === true,
      marketing_enabled: parsed.enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) return noStore(jsonErr('Could not update marketing preferences', 503));
    return noStore(jsonOk({ marketing: parsed.enabled }));
  }

  if (!pushConfigured())
    return noStore(jsonErr('Device notifications are not configured yet', 503));
  const s = parsed.subscription;
  if (!eligibleEndpoint(s.endpoint))
    return noStore(jsonErr('Unsupported push provider', 400));

  const [owner, count] = await Promise.all([
    db.from('web_push_subscriptions').select('user_id').eq('endpoint', s.endpoint).maybeSingle(),
    db.from('web_push_subscriptions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('enabled', true),
  ]);
  if (owner.error || count.error)
    return noStore(jsonErr('Could not validate device registration', 503));
  if (owner.data && owner.data.user_id !== userId)
    return noStore(jsonErr('This device is registered to another account. Reset its browser push subscription first.', 409));
  if (!owner.data && (count.count ?? 0) >= 3)
    return noStore(jsonErr('Maximum 3 notification devices. Disable an older device first.', 409));

  const { error: deviceError } = await db.from('web_push_subscriptions')
    .upsert({
      user_id: userId, endpoint: s.endpoint,
      p256dh: s.keys.p256dh, auth_secret: s.keys.auth,
      enabled: true, failure_count: 0,
      revoked_at: null, last_seen_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
  if (deviceError) return noStore(jsonErr('Could not register this device', 503));
  const { error: consentError } = await db.from('web_push_preferences')
    .upsert({
      user_id: userId, push_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (consentError) return noStore(jsonErr('Could not store notification permission', 503));

  return noStore(jsonOk({ enabled: true }));
}
