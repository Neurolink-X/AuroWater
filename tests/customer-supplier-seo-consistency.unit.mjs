import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeOrder, liveMessage, stepIndex, isActiveStatus, reorderHref } from '../src/lib/order-status.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const customerApi = read('src/app/api/customer/orders/[id]/route.ts');
const supplierApi = read('src/app/api/supplier/orders/route.ts');
const supplierTransition = read('src/app/api/supplier/orders/[id]/route.ts');
const dispatch = read('src/lib/dispatch.ts');

const example = (status, overrides = {}) => normalizeOrder({
  id: '23411111-2222-4333-8444-555555555555',
  order_number: 'AW-19401', status, customer_id: 'customer-1',
  supplier_id: status === 'PENDING' ? null : 'supplier-1',
  service_type: 'water_can', can_count: 2, total_amount: 40,
  payment_status: status === 'COMPLETED' ? 'paid' : 'pending',
  ...overrides,
});

test('customer timeline moves forward through the supplier delivery lifecycle', () => {
  const statuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
  assert.deepEqual(statuses.map(stepIndex), [0, 1, 2, 3]);
  assert.deepEqual(statuses.map(isActiveStatus), [true, true, true, false]);
  for (const status of statuses) {
    const order = example(status);
    assert.equal(order.status, status);
    assert.ok(liveMessage(order).title);
    assert.equal(order.canCount, 2);
    assert.equal(order.totalAmount, 40);
    assert.equal(reorderHref(order), '/book?service=water_can&cans=2');
  }
  assert.match(liveMessage(example('COMPLETED')).sub, /AuroTap/);
  assert.equal(isActiveStatus('CANCELLED'), false);
});

test('customer tracking API authenticates ownership before privileged provider enrichment', () => {
  assert.match(customerApi, /requireRole\(auth\.ctx, 'customer'\)/);
  assert.match(customerApi, /\.eq\('customer_id', auth\.ctx\.profile\.id\)/);
  assert.ok(customerApi.indexOf("if (!data)") < customerApi.indexOf('const admin = createServiceClient()'));
  assert.match(customerApi, /Promise\.all\(\[/);
  assert.match(customerApi, /technician_profile: technicianProfile/);
  assert.match(customerApi, /supplier_profile: supplierProfile/);
  assert.match(customerApi, /Cache-Control', 'private, no-store/);
  assert.match(customerApi, /force-dynamic/);
  assert.match(customerApi, /service_type_key: row\.service_type/);
});

test('supplier only reads assigned orders and hides private address/contact until acceptance', () => {
  assert.match(supplierApi, /requireRole\(auth\.ctx, 'supplier'\)/);
  assert.match(supplierApi, /\.eq\('supplier_id', auth\.ctx\.profile\.id\)/);
  assert.match(supplierApi, /ACTIVE_CONTACT_STATUSES/);
  assert.match(supplierApi, /accepted_at/);
  assert.match(supplierApi, /function redact\(/);
  assert.match(supplierApi, /SECRET_KEY/);
  assert.match(supplierApi, /PRIVATE_KEY/);
});

test('supplier status updates use guarded transitions and atomic payment reconciliation', () => {
  assert.match(supplierTransition, /ASSIGNED: 'IN_PROGRESS'/);
  assert.match(supplierTransition, /IN_PROGRESS: 'COMPLETED'/);
  assert.match(supplierTransition, /\.eq\('supplier_id', supplierId\)/);
  assert.match(supplierTransition, /\.eq\('status', prev\)/);
  assert.match(supplierTransition, /payment_confirmed/);
  assert.match(supplierTransition, /payment_reference/);
  assert.match(supplierTransition, /payment_collector/);
  assert.match(supplierTransition, /complete_supplier_order_atomic/);
  assert.match(supplierTransition, /customer notification/);
  assert.match(dispatch, /try_assign_supplier_with_stock/);
});

test('local service SEO uses supported cities and avoids unsupported coverage claims', () => {
  const services = read('src/app/(public)/services/services-data.ts');
  const sitemap = read('src/app/sitemap.ts');
  const robots = read('src/app/robots.ts');
  const waterDelivery = read('src/app/(public)/water-delivery/page.tsx');
  for (const term of ['20 litre drinking water jar home delivery', 'water purifier filter replacement', 'water storage tank cleaning service']) {
    assert.ok(services.includes(term), term);
  }
  assert.match(services, /LIVE_CITIES\.flatMap/);
  assert.match(sitemap, /canIndexDeployment/);
  assert.match(robots, /canIndexDeployment/);
  assert.doesNotMatch(sitemap, /\/customer\/track/);
  assert.match(waterDelivery, /cities\.filter\(\(city\) => city\.status === 'active'\)/);
  assert.match(waterDelivery, /'@type': 'Service'/);
  assert.match(waterDelivery, /areaServed: active\.map/);
});

test('concurrent checkout attempts use a database unique key, not only a time-based lookup', () => {
  const checkout = read('src/app/api/customer/orders/route.ts');
  const wizard = read('src/components/booking/BookingWizard.tsx');
  const migration = read('supabase/migrations/202611010001_checkout_request_idempotency.sql');
  assert.match(migration, /add column if not exists checkout_request_id uuid/i);
  assert.match(migration, /create unique index if not exists orders_customer_checkout_request_unique_idx/i);
  assert.match(migration, /\(customer_id, checkout_request_id\)/);
  assert.doesNotMatch(checkout, /process\.env\.CHECKOUT_IDEMPOTENCY_DB_ENABLED/);
  assert.match(checkout, /const checkoutKey = checkoutRequestId \|\| null/);
  assert.match(checkout, /checkout_request_id: checkoutKey/);
  assert.match(checkout, /oErr\?\.code === '23505'/);
  assert.match(checkout, /findExistingCheckout\(\)/);
  assert.match(wizard, /checkoutAttempt = useRef/);
  assert.match(wizard, /crypto\.randomUUID\(\)/);
  assert.match(wizard, /checkout_request_id: key/);
});

test('rate-limit infrastructure failure never silently authorizes public writes or private file uploads', () => {
  const contact = read('src/app/api/contact/route.ts');
  const upload = read('src/app/api/files/upload/route.ts');
  const limiter = read('src/lib/api/rate-limit.ts');
  const sql = read('supabase/migrations/202610300003_account_recovery_durable_controls.sql');
  assert.match(contact, /rate\.unavailable/);
  assert.match(upload, /rate\.unavailable/);
  assert.match(contact, /RATE_LIMIT_UNAVAILABLE/);
  assert.match(upload, /RATE_LIMIT_UNAVAILABLE/);
  assert.match(contact, /Retry-After/);
  assert.match(upload, /Retry-After/);
  assert.match(limiter, /createHmac/);
  assert.match(sql, /on conflict \(key_hash\) do update/);
});
