#!/usr/bin/env node
/**
 * Safe authenticated smoke test. It only reads data and deliberately submits
 * an incomplete order to verify customer authorization without creating data.
 *
 * Required: BASE_URL, SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD
 * Optional: SMOKE_EXPECTED_ROLE (defaults to customer)
 */
const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const email = process.env.SMOKE_TEST_EMAIL?.trim();
const password = process.env.SMOKE_TEST_PASSWORD;
const expectedRole = process.env.SMOKE_EXPECTED_ROLE?.trim() || 'customer';

if (!email || !password) {
  console.error('Set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD for a dedicated development Supabase user.');
  process.exit(2);
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...options });
  const body = await response.json().catch(() => null);
  return { response, body };
}

const login = await request('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.response.ok || !login.body?.data?.access_token) {
  throw new Error(`Login failed (${login.response.status}): ${login.body?.error ?? 'unknown error'}`);
}

const token = login.body.data.access_token;
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const me = await request('/api/auth/me', { headers });
if (!me.response.ok || me.body?.data?.role !== expectedRole) {
  throw new Error(`Unexpected smoke-user role: expected ${expectedRole}, got ${me.body?.data?.role ?? 'none'}`);
}

const addresses = await request('/api/customer/addresses', { headers });
if (!addresses.response.ok || !Array.isArray(addresses.body?.data)) {
  throw new Error(`Address read failed (${addresses.response.status}).`);
}

const rejectedOrder = await request('/api/customer/orders', {
  method: 'POST',
  headers,
  body: JSON.stringify({}),
});
if (rejectedOrder.response.status !== 400) {
  throw new Error(`Expected safe invalid order to return 400, got ${rejectedOrder.response.status}.`);
}

console.log(`Authenticated API smoke passed for ${expectedRole}; ${addresses.body.data.length} address(es) read; no data created.`);
