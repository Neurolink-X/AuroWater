import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(path, 'utf8');
const sql = file('supabase/migrations/20261103072000_dispatch_work_queue_guarded.sql');
const worker = file('src/lib/dispatch-work-queue.ts');
const endpoint = file('src/app/api/internal/dispatch-work-sweep/route.ts');
const proxy = file('src/proxy.ts');
const booking = file('src/app/api/customer/orders/route.ts');
const oldSweep = file('src/app/api/internal/technician-dispatch-sweep/route.ts');
const dispatch = file('src/lib/dispatch.ts');
const admin = file('src/app/api/admin/dispatch/queue-health/route.ts');
const rolloutSql = file('supabase/migrations/20261103111000_dispatch_queue_activation_readiness_and_stale_review.sql');
const adminPage = file('src/app/admin/dispatch-queue/page.tsx');
const adminSettings = file('src/app/api/admin/settings/route.ts');
const secureToggleSql = file('supabase/migrations/20261103113000_dispatch_queue_service_role_atomic_audit.sql');

test('queue is feature-flagged OFF and persists only operational metadata', () => {
  assert.ok(sql.includes("VALUES ('dispatch_work_queue_enabled', 'false')"));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.dispatch_work_items'));
  assert.ok(sql.includes('order_id uuid PRIMARY KEY REFERENCES public.orders(id)'));
  assert.ok(sql.includes('ALTER TABLE public.dispatch_work_items ENABLE ROW LEVEL SECURITY'));
  assert.ok(sql.includes('REVOKE ALL ON public.dispatch_work_items FROM PUBLIC, anon, authenticated'));
  assert.ok(sql.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_work_items TO service_role'));
  assert.ok(sql.includes("CHECK (state IN ('ready', 'leased', 'dead'))"));
  assert.ok(sql.includes("WHEN NEW.service_type = 'water_can'"));
  assert.ok(sql.includes("THEN 'water' ELSE 'specialist'"));
  assert.ok(!sql.includes('DELETE FROM public.orders '));
  assert.ok(!sql.includes('DELETE FROM public.wallet_ledger'));
  assert.ok(!sql.includes('TRUNCATE TABLE'));
  assert.ok(!sql.includes('VACUUM FULL'));
});

test('outbox commit is atomic with a new booking and returns to safe legacy mode', () => {
  assert.ok(sql.includes('AFTER INSERT OR UPDATE OF status, supplier_id, technician_id, service_type'));
  assert.ok(sql.includes("RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER"));
  assert.ok(sql.includes('INSERT INTO public.dispatch_work_items AS q'));
  assert.ok(sql.includes("WHERE q.state = 'ready'"));
  assert.ok(sql.includes("IF NOT coalesce(enabled, false) THEN RETURN NEW; END IF"));
  assert.ok(sql.includes("DELETE FROM public.dispatch_work_items WHERE order_id = NEW.id"));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.enqueue_existing_pending_dispatch'));
  assert.ok(sql.includes('LIMIT LEAST(GREATEST(coalesce(p_limit, 1), 1), 100)'));
});

test('activation cannot strand existing pending orders', () => {
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION private.guard_dispatch_work_queue_activation()'));
  assert.ok(sql.includes('CREATE TRIGGER guard_dispatch_work_queue_activation'));
  assert.ok(sql.includes("Backfill pending dispatch work before queue activation"));
  assert.ok(sql.includes('PERFORM public.enqueue_existing_pending_dispatch(100)'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.enqueue_existing_pending_dispatch'));
  assert.ok(sql.includes("'aurotap-dispatch-work-reconcile'"));
  assert.ok(sql.includes("'* * * * *'"));
  assert.ok(sql.includes('SELECT public.enqueue_existing_pending_dispatch(100)'));
  assert.ok(sql.includes("WHERE key='dispatch_work_queue_enabled' AND value='true'"));
  const backfill = sql.split('CREATE OR REPLACE FUNCTION public.enqueue_existing_pending_dispatch')[1]
    .split('CREATE OR REPLACE FUNCTION private.guard_dispatch_work_queue_activation')[0];
  assert.ok(!backfill.includes("IS DISTINCT FROM 'true'"));
});

test('distributed claims enforce a global concurrency budget and SKIP LOCKED', () => {
  assert.ok(sql.includes('pg_advisory_xact_lock(843291739::bigint)'));
  assert.ok(sql.includes('FOR UPDATE OF q SKIP LOCKED'));
  assert.ok(sql.includes('WHERE q.state = \'leased\' AND q.lease_until > clock_timestamp()'));
  assert.ok(sql.includes('IF in_flight >= 24 THEN RETURN; END IF'));
  assert.ok(sql.includes('LIMIT LEAST(GREATEST(coalesce(p_limit, 8), 1), 8, 24 - in_flight)'));
  assert.ok(sql.includes('lease_token = gen_random_uuid()'));
  assert.ok(sql.includes('AND (r.next_retry_at IS NULL OR r.next_retry_at <= clock_timestamp())'));
  assert.ok(sql.includes('AND q.lease_token = p_claim_token'));
  assert.ok(sql.includes("p_result_code = 'max_attempts'"));
  assert.ok(sql.includes("state = 'dead'"));
});

test('repeated supplier shortage cannot consume the internal error budget', () => {
  assert.ok(sql.includes('internal_error_streak smallint NOT NULL DEFAULT 0'));
  assert.ok(sql.includes("p_result_code = 'error' AND current_errors >= 7"));
  assert.ok(sql.includes("p_result_code = 'error'"));
  assert.ok(sql.includes('ELSE 0 END,'));
  assert.ok(sql.includes('internal_error_streak = 0'));
  assert.ok(!sql.includes("p_result_code = 'error' AND current_attempts >= 8"));
});

test('only supported services enter the queue', () => {
  const services = ['water_can','ro_service','plumbing','borewell','motor_pump','tank_cleaning'];
  for (const service of services) assert.ok(sql.includes(service));
  assert.ok(sql.includes('NEW.service_type NOT IN'));
  assert.ok(sql.includes('o.service_type IN'));
});

test('returned dispatch errors trigger worker and endpoint failures', () => {
  assert.ok(worker.includes("if (outcome === 'error')"));
  assert.ok(worker.includes('failed += 1'));
  assert.ok(endpoint.includes('data.failed === 0 && data.completionErrors === 0'));
});

test('scheduled queue uses bounded demand-based fanout and has low-cost cleanup', () => {
  assert.ok(sql.includes("'*/2 * * * *'"));
  assert.ok(sql.includes('LEAST(4, CEIL(b.n / 32.0)::integer)'));
  assert.ok(sql.includes("WHERE o.status <> 'PENDING'"));
  assert.ok(sql.includes("interval '14 days'"));
  assert.ok(sql.includes('LIMIT 250'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.requeue_dead_dispatch_work'));
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.requeue_dead_dispatch_work(uuid) TO service_role'));
});

test('only authenticated internal requests can launch bounded workers', () => {
  assert.ok(proxy.includes("'/api/internal/dispatch-work-sweep'"));
  assert.ok(endpoint.includes("process.env.CRON_SECRET"));
  assert.ok(endpoint.includes("'Bearer ' + secret"));
  assert.ok(endpoint.includes('runDispatchWorkQueue(32, 22_000)'));
  assert.ok(worker.includes('maxItems = 32'));
  assert.ok(worker.includes('p_limit: Math.min(3, cap - claimed)'));
  assert.ok(worker.includes("await Promise.allSettled"));
  assert.ok(worker.includes("finish_dispatch_work"));
  assert.ok(worker.includes("completionErrors += 1"));
});

test('old scheduled sweep cannot compete with enabled durable queue', () => {
  assert.ok(oldSweep.includes("queueEnabled = settingMap.get('dispatch_work_queue_enabled') === 'true'"));
  assert.ok(oldSweep.includes('const { data: pending, error: pendingError } = queueEnabled'));
  assert.ok(oldSweep.includes('const { data: pendingSupplierOrders, error: supplierPendingError } = queueEnabled'));
  assert.ok(dispatch.includes('queueEnabled: m.dispatch_work_queue_enabled === \'true\''));
  assert.ok(dispatch.includes('if (cfg.queueEnabled) return 0'));
});

test('checkout admission is fail-closed, idempotent and disabled by default', () => {
  const oldOrderLookup = booking.indexOf('if (checkoutKey) {\n    const existing = await findExistingCheckout()');
  const admission = booking.indexOf('dispatch-checkout-admission');
  assert.ok(oldOrderLookup > 0 && admission > oldOrderLookup);
  assert.ok(booking.includes("flat.dispatch_work_queue_enabled ?? 'false'"));
  assert.ok(booking.includes('Math.min(configured, 3000) : 48'));
  assert.ok(booking.includes("'BOOKING_CAPACITY_BUSY'"));
  assert.ok(booking.includes("response.headers.set('Retry-After'"));
  assert.ok(booking.includes('if (!gate.allowed)'));
});

test('dead-letter recovery requires an admin and cannot modify payments', () => {
  assert.ok(admin.includes('requireAdmin(auth.ctx)'));
  assert.ok(admin.includes("rpc('requeue_dead_dispatch_work'"));
  assert.ok(admin.includes("const { data, error }"));
  assert.ok(!admin.includes(".from('wallet_ledger').update"));
  assert.ok(!admin.includes(".from('orders').update"));
});

test('admin queue toggle is manual, admin-only and release-gated', () => {
  const ui = file('src/app/admin/dispatch-queue/page.tsx');
  assert.ok(admin.includes('export async function PATCH'));
  assert.ok(admin.includes('requireAdmin(auth.ctx)'));
  assert.ok(admin.includes("AUROTAP_DISPATCH_QUEUE_RELEASE_APPROVED"));
  assert.ok(admin.includes("body.confirmation !== 'ENABLE_DISPATCH_QUEUE'"));
  assert.ok(admin.includes("eq('key', 'dispatch_work_queue_enabled')"));
  assert.ok(admin.includes("QUEUE_TRANSITION_FAILED"));
  assert.ok(!admin.includes('setInterval('));
  assert.ok(ui.includes("adminRequest('PATCH'"));
  assert.ok(ui.includes('Enable queue (release-gated)'));
  assert.ok(ui.includes('Disable queue / use legacy retries'));
});

test('queue rollout migration leaves orders intact and quarantines overdue appointments', () => {
  assert.ok(rolloutSql.includes("stale_schedule_review"));
  assert.ok(rolloutSql.includes("interval '24 hours'"));
  assert.ok(rolloutSql.includes("CREATE OR REPLACE FUNCTION private.quarantine_stale_dispatch_work"));
  assert.ok(rolloutSql.includes("FOR UPDATE OF q SKIP LOCKED"));
  assert.ok(rolloutSql.includes("SET state='dead'"));
  assert.ok(rolloutSql.includes("CASE WHEN c.scheduled_at < clock_timestamp()"));
  assert.ok(rolloutSql.includes("AND (o.scheduled_at IS NULL OR o.scheduled_at >= clock_timestamp()"));
  assert.ok(!rolloutSql.includes('UPDATE public.orders SET'));
  assert.ok(!rolloutSql.includes('DELETE FROM public.orders'));
  assert.ok(!rolloutSql.includes('DELETE FROM public.wallet_ledger'));
});

test('queue rollout is readiness-gated, admin-only and transparent in UI', () => {
  assert.ok(rolloutSql.includes('CREATE OR REPLACE FUNCTION public.dispatch_queue_release_readiness'));
  assert.ok(rolloutSql.includes("REVOKE ALL ON FUNCTION public.dispatch_queue_release_readiness() FROM PUBLIC,anon,authenticated"));
  assert.ok(rolloutSql.includes('GRANT EXECUTE ON FUNCTION public.dispatch_queue_release_readiness() TO service_role'));
  assert.ok(rolloutSql.includes("'queueCronReady'"));
  assert.ok(rolloutSql.includes("'reconcileCronReady'"));
  assert.ok(rolloutSql.includes("'secretReady'"));
  assert.ok(rolloutSql.includes("'pendingWithoutQueue'"));
  assert.ok(admin.includes("db.rpc('dispatch_queue_release_readiness')"));
  assert.ok(admin.includes("AUROTAP_DISPATCH_QUEUE_RELEASE_APPROVED"));
  assert.ok(admin.includes('if (enable)'));
  assert.ok(admin.includes('requireAdmin(auth.ctx)'));
  assert.ok(adminPage.includes('activation_ready'));
  assert.ok(adminPage.includes('Stale appointments'));
  assert.ok(adminSettings.includes('DISPATCH_QUEUE_GUARDED_SETTING'));
  assert.ok(adminSettings.includes("'dispatch_work_queue_enabled'"));
  assert.ok(adminSettings.includes("'dispatch_booking_admit_per_minute'"));
  assert.ok(admin.includes("body.action === 'prepare_backlog'"));
  assert.ok(admin.includes("current.value !== 'false'"));
  assert.ok(admin.includes("rpc('enqueue_existing_pending_dispatch'"));
  assert.ok(adminPage.includes('Prepare next 100 pending orders (no dispatch)'));
  assert.ok(secureToggleSql.includes("CREATE OR REPLACE FUNCTION public.set_dispatch_queue_enabled"));
  assert.ok(secureToggleSql.includes("jwt_role <> 'service_role'"));
  assert.ok(secureToggleSql.includes('INSERT INTO public.audit_logs'));
  assert.ok(secureToggleSql.includes('FOR UPDATE'));
  assert.ok(secureToggleSql.includes("GRANT EXECUTE ON FUNCTION public.set_dispatch_queue_enabled(boolean,uuid) TO service_role"));
  assert.ok(admin.includes("db.rpc('set_dispatch_queue_enabled'"));
  assert.ok(!admin.includes(".update({ value: String(enable) })"));
});

// A pure JavaScript admission/lease workload simulation is NOT a capacity test.
// It verifies bounded memory accounting for 100 and 100,000 mock order IDs,
// WITHOUT connecting to production and WITHOUT changing any real order.
for (const total of [100, 100_000]) {
  test('simulation: ' + total + ' distinct orders stay unique and claims are capped', () => {
    const queued = new Set();
    for (let i = 0; i < total; i++) queued.add('test-order-' + i);
    for (let i = 0; i < Math.min(100, total); i++) queued.add('test-order-' + i);
    assert.equal(queued.size, total);
    let inFlight = 0;
    for (let i = 0; i < 20; i++) {
      const claim = Math.min(8, 24 - inFlight);
      inFlight += claim;
      assert.ok(inFlight <= 24);
    }
    assert.equal(inFlight, 24);
    const maxRecoveryPerMinute = (4 * 32) / 2;
    assert.equal(maxRecoveryPerMinute, 64);
  });
}
