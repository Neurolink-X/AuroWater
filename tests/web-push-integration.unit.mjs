import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const db = read('supabase/migrations/20261103051000_web_push_opt_in_outbox.sql');
const routes = read('src/app/api/notifications/push/route.ts');
const sender = read('src/lib/web-push-server.ts');
const worker = read('src/lib/web-push-worker.ts');
const sw = read('public/sw.js');
const inbox = read('src/app/api/notifications/inbox/route.ts');
const page = read('src/app/notifications/page.tsx');
const cron = read('src/app/api/internal/web-push-sweep/route.ts');
const notifier = read('src/lib/notifications.ts');

test('subscriptions and outbox are private, require consent and have bounded delivery', () => {
  assert.match(db, /web_push_preferences/);
  assert.match(db, /push_enabled boolean NOT NULL DEFAULT false/);
  assert.match(db, /marketing_enabled boolean NOT NULL DEFAULT false/);
  assert.match(db, /UNIQUE\(notification_id, subscription_id\)/);
  assert.match(db, /FOR UPDATE SKIP LOCKED/);
  assert.match(db, /LIMIT LEAST\(GREATEST\(p_limit, 1\), 12\)/);
  assert.match(db, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(db, /REVOKE ALL ON public\.web_push_preferences, public\.web_push_subscriptions,/);
  assert.match(db, /NEW\.type <> 'promo' OR pref\.marketing_enabled/);
  assert.match(db, /state IN \('delivered','revoked'\) AND updated_at < now\(\)-interval '7 days'/);
  assert.match(db, /state = 'failed' AND updated_at < now\(\)-interval '30 days'/);
  assert.match(db, /LIMIT 300/);
  assert.doesNotMatch(db, /DELETE FROM public\.orders|DELETE FROM public\.notifications/i);
});

test('browser permission only requested on click and can be disabled', () => {
  assert.match(page, /const enable = async/);
  assert.match(page, /Notification\.requestPermission\(\)/);
  assert.match(page, /const disable = async/);
  assert.match(page, /action: 'disable'/);
  assert.match(page, /onClick=\{\(\) => void enable\(\)\}/);
  assert.match(page, /onClick=\{\(\) => void disable\(\)\}/);
  assert.match(page, /Marketing|Promotional|Promotional alerts|promotional alerts/);
  assert.match(routes, /action: z\.literal\('subscribe'\)/);
  assert.match(routes, /action: z\.literal\('marketing'\)/);
  assert.match(routes, /action: z\.literal\('disable'\)/);
  assert.match(routes, /requireSupabaseAuth\(req\)/);
  assert.match(routes, /count\.count \?\? 0\) >= 3/);
  assert.match(routes, /eligibleEndpoint\(s\.endpoint\)/);
});

test('Web Push is encrypted server-side and provider endpoints are allowlisted', () => {
  assert.match(sender, /createCipheriv\('aes-128-gcm'/);
  assert.match(sender, /hkdfSync\('sha256'/);
  assert.match(sender, /VAPID_PRIVATE_KEY/);
  assert.match(sender, /new Uint8Array\(encrypted\)/);
  assert.match(sender, /redirect: 'error'/);
  assert.match(sender, /AbortSignal\.timeout\(7000\)/);
  // Domain allowlist assertions are exact literals rather than unanchored URL
  // regexes, so CodeQL can prove no arbitrary prefix/suffix matches.
  assert.ok(sender.includes("'fcm.googleapis.com'"));
  assert.ok(sender.includes("'updates.push.services.mozilla.com'"));
  assert.ok(sender.includes("'web.push.apple.com'"));
  assert.ok(sender.includes("url.hostname.toLowerCase()"));
  assert.ok(sender.includes("url.protocol !== 'https:'"));
  assert.doesNotMatch(sender, /NEXT_PUBLIC_WEB_PUSH_VAPID_PRIVATE_KEY/);
  assert.match(sw, /self\.addEventListener\('push'/);
  assert.match(sw, /self\.addEventListener\('notificationclick'/);
  assert.match(sw, /self\.registration\.showNotification/);
  assert.match(sw, /safePushPath/);
});

test('background worker uses bounded concurrency and never changes orders', () => {
  assert.match(worker, /processDueWebPush/);
  assert.match(worker, /const jobs = \(data \?\? \[\]\) as Delivery\[\]/);
  assert.match(worker, /index \+= 3/);
  assert.match(worker, /notification\.user_id === sub\.user_id/);
  assert.match(worker, /prefs\?\.push_enabled/);
  assert.match(worker, /\.eq\('state', 'leased'\)/);
  assert.doesNotMatch(worker, /\.from\('orders'\)\.(?:update|delete|insert)/);
  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(cron, /processDueWebPush\(8\)/);
  assert.match(db, /WHERE EXISTS \(/);
});

test('secure cross-role inbox reads only authenticated user messages', () => {
  assert.match(inbox, /requireSupabaseAuth\(req\)/g);
  assert.match(inbox, /\.eq\('user_id', auth\.ctx\.profile\.id\)/g);
  assert.match(inbox, /\.limit\(25\)/);
  assert.match(inbox, /cacheOff/);
  assert.match(notifier, /after\(async \(\) =>/);
  assert.match(notifier, /processDueWebPush\(4\)/);
});
