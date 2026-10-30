import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestJson, jsonHeaders } from '../src/lib/api/transport.ts';

const parse = (res) => res.json();
const response = (status = 200) => new Response(JSON.stringify({ success: true }), { status });

test('preserves Headers, tuples and explicit content types', () => {
  for (const input of [new Headers({ Authorization: 'Bearer refreshed' }), [['Authorization', 'Bearer refreshed']], { Authorization: 'Bearer refreshed' }]) {
    assert.equal(jsonHeaders(input).get('authorization'), 'Bearer refreshed');
  }
  assert.equal(jsonHeaders({ 'Content-Type': 'custom' }).get('content-type'), 'custom');
});

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  test(`${method} is never replayed after an uncertain network failure or 503`, async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('response lost'); });
    await assert.rejects(requestJson('/api/write', { method }, parse), /response lost/);
    assert.equal(calls, 1);
    t.mock.restoreAll();
    calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return response(503); });
    assert.equal((await requestJson('/api/write', { method }, parse)).res.status, 503);
    assert.equal(calls, 1);
  });
}

test('GET recovers once from network loss with headers and credentials intact', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.headers.get('authorization'), 'Bearer token');
    assert.equal(init.credentials, 'include');
    if (++calls === 1) throw new TypeError('offline');
    return response();
  });
  assert.equal((await requestJson('/api/read', { headers: new Headers({ Authorization: 'Bearer token' }) }, parse)).body.success, true);
  assert.equal(calls, 2);
});

test('GET retries 503 only once, and does not retry 401 or 429', async (t) => {
  for (const status of [503, 401, 429]) {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return response(status); });
    assert.equal((await requestJson('/api/read', {}, parse)).res.status, status);
    assert.equal(calls, status === 503 ? 2 : 1);
    t.mock.restoreAll();
  }
});

test('pre-cancelled reads never reach the network', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('must not fetch'));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(requestJson('/api/read', { signal: controller.signal }, parse), { name: 'AbortError' });
});

test('cancellation during backoff prevents another request', async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; setTimeout(() => controller.abort(), 10); return response(503); });
  await assert.rejects(requestJson('/api/read', { signal: controller.signal }, parse), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('stalled reads time out without retrying', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  await assert.rejects(requestJson('/api/read', {}, parse, 15), { name: 'TimeoutError' });
  assert.equal(calls, 1);
});

test('deadline covers stalled body consumption even if parser catches abort', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => ({
    json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  }));
  await assert.rejects(requestJson('/api/read', {}, (res) => res.json().catch(() => ({})), 15), { name: 'TimeoutError' });
});

test('writes retain their existing runtime budget', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(signal.aborted, false);
    return response();
  });
  assert.equal((await requestJson('/api/write', { method: 'POST' }, parse, 5)).res.status, 200);
});
