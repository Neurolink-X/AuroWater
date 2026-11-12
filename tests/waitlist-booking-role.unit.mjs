import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { submitWaitlist } from '../src/lib/waitlist-client.ts';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function loadSource(path, dependencies) {
  const exports = {};
  const result = transpileModule(read(path), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  });
  vm.runInNewContext(result.outputText, {
    exports, Response, AbortSignal,
    console: { error() {} },
    require: id => Object.hasOwn(dependencies, id) ? dependencies[id] : require(id),
  });
  return exports;
}

test('signed-out waitlist and city discovery reach their route handlers', () => {
  const { NextRequest } = require('next/server');
  const { proxy } = loadSource('src/proxy.ts', {});
  for (const [path, method] of [
    ['/api/waitlist', 'POST'], ['/api/waitlist', 'GET'],
    ['/api/cities', 'GET'], ['/api/public/ncr-waitlist', 'POST'],
    ['/service-areas', 'GET'], ['/cities/kolkata', 'GET'],
  ]) {
    const response = proxy(new NextRequest(`https://www.aurotap.in${path}`, { method }));
    assert.equal(response.headers.get('location'), null, path);
    assert.equal(response.headers.get('x-middleware-next'), '1', path);
  }
  const admin = proxy(new NextRequest('https://www.aurotap.in/admin/dashboard'));
  assert.match(admin.headers.get('location'), /\/admin\/login/);
});

for (const [label, status, body] of [
  ['empty gateway error', 502, ''],
  ['HTML login response', 200, '<html>Sign in</html>'],
  ['truncated JSON', 200, '{"data":'],
  ['missing receipt', 200, '{}'],
  ['rejected receipt', 200, '{"data":{"success":false,"message":"Rejected"}}'],
]) {
  test(`submission rejects ${label} without a JSON parser error or write replay`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(body, { status }));
    await assert.rejects(submitWaitlist({ custom_city: 'Kolkata' }), error => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /JSON|Unexpected end|Unexpected token/);
      return true;
    });
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test('successful and legacy duplicate receipts confirm the request', async t => {
  const payload = { custom_city: 'Kolkata', area: 'Salt Lake', phone: '9876543210' };
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ data: { success: true } }));
  await submitWaitlist(payload);
  const [path, options] = fetch.mock.calls[0].arguments;
  assert.equal(path, '/api/waitlist');
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'error');
  assert.deepEqual(JSON.parse(options.body), payload);
  fetch.mock.mockImplementation(async () => Response.json({ data: { message: 'Already on waitlist.' } }));
  await submitWaitlist(payload);
});

test('network failure keeps the error actionable and never replays the POST', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(submitWaitlist({}), /Check your connection/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('a stalled submission times out and releases the caller', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetch = t.mock.method(globalThis, 'fetch', async (_path, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const pending = submitWaitlist({});
  t.mock.timers.tick(12_000);
  await assert.rejects(pending, /took too long to confirm/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('unmount cancellation is distinct from a submission failure', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_path, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const pending = submitWaitlist({}, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

function waitlistRoute({ duplicate = false, lookupError = false, insertError = false } = {}) {
  const writes = [];
  const filters = [];
  let reads = 0;
  const db = {
    from() {
      let writing = false;
      const query = {
        select() { return query; },
        eq(column, value) { filters.push([column, value]); return query; },
        ilike(column, value) { filters.push([column, value]); return query; },
        gte() { return query; }, limit() { return query; }, maybeSingle() { return query; },
        abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return query; },
        insert(payload) { writes.push(payload); writing = true; return query; },
        then(resolve, reject) {
          if (!writing) reads++;
          const error = writing ? insertError : lookupError;
          return Promise.resolve({ data: !writing && duplicate ? { id: 'existing' } : null,
            error: error ? { code: 'unavailable' } : null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const route = loadSource('src/app/api/waitlist/route.ts', {
    '@/lib/api/json-response': {
      jsonErr: (error, status) => Response.json({ error }, { status }),
      jsonOk: data => Response.json({ data }),
    },
    '@/lib/api/supabase-request': {
      requireSupabaseAuth: async () => ({ ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }),
      requireAdmin: () => false,
    },
    '@/lib/cities': { isCityUuid: () => false },
    '@/utils/supabase/server': { createServiceClient: () => db },
  });
  return { ...route, writes, filters, readCount: () => reads };
}

const submission = { custom_city: ' Kolkata ', area: ' Salt Lake ', name: 'Kolkata visitor',
  phone: '+91 98765 43210', email: ' VISITOR@EXAMPLE.COM ', source: 'service-areas' };
const request = body => new Request('https://www.aurotap.in/api/waitlist', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('Kolkata phone and email submission persists normalized details with a JSON receipt', async () => {
  const route = waitlistRoute();
  const response = await route.POST(request(submission));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.success, true);
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(route.readCount(), 2);
  assert.equal(route.writes.length, 1);
  assert.equal(route.writes[0].custom_city, 'Kolkata');
  assert.equal(route.writes[0].area, 'Salt Lake');
  assert.equal(route.writes[0].phone, '9876543210');
  assert.equal(route.writes[0].email, 'visitor@example.com');
});

test('duplicates receive a successful receipt without another insert', async () => {
  const route = waitlistRoute({ duplicate: true });
  const response = await route.POST(request(submission));
  assert.equal((await response.json()).data.success, true);
  assert.equal(route.writes.length, 0);
});

for (const failure of ['lookupError', 'insertError']) {
  test(`${failure} produces a retryable JSON response`, async () => {
    const route = waitlistRoute({ [failure]: true });
    const response = await route.POST(request(submission));
    assert.equal(response.status, 503);
    assert.equal(typeof (await response.json()).error, 'string');
    assert.ok(response.headers.get('x-request-id'));
    if (failure === 'lookupError') assert.equal(route.writes.length, 0);
  });
}

test('email-only, phone-only and literal wildcard localities remain supported', async () => {
  for (const body of [
    { ...submission, phone: null }, { ...submission, email: null },
    { ...submission, custom_city: 'Kolkata%', area: 'Sector_1' },
  ]) {
    const route = waitlistRoute();
    assert.equal((await route.POST(request(body))).status, 200);
    assert.equal(route.writes.length, 1);
    if (body.custom_city.endsWith('%')) {
      assert.ok(route.filters.some(([column, value]) => column === 'custom_city' && value === 'Kolkata\\%'));
      assert.ok(route.filters.some(([column, value]) => column === 'area' && value === 'Sector\\_1'));
    }
  }
});

test('invalid contact details, incomplete JSON and bots never write records', async () => {
  const route = waitlistRoute();
  for (const body of [
    { ...submission, phone: '12345678909876543210' },
    { ...submission, email: 'invalid' }, { ...submission, pincode: '000000' },
    { ...submission, lat: 91 }, { ...submission, phone: null, email: null },
  ]) assert.equal((await route.POST(request(body))).status, 400);
  assert.equal((await route.POST(new Request('https://www.aurotap.in/api/waitlist', { method: 'POST', body: '{' }))).status, 400);
  assert.equal((await route.POST(request({ ...submission, website: 'spam' }))).status, 200);
  assert.equal(route.writes.length, 0);
});

test('public POST access keeps waitlist administration authenticated', async () => {
  const route = waitlistRoute();
  const response = await route.GET(new Request('https://www.aurotap.in/api/waitlist'));
  assert.equal(response.status, 401);
  assert.equal(route.readCount(), 0);
});
