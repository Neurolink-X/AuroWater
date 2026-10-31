import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('service verification is rate limited with per-order locking and no public attempt data', () => {
  const s = read('sql/secure_technician_service_otp_attempts_20261031.sql');
  assert.match(s, /service_otp_attempt_limits/);
  assert.match(s, /ENABLE ROW LEVEL SECURITY/);
  assert.match(s, /REVOKE ALL ON TABLE public.service_otp_attempt_limits FROM PUBLIC, anon, authenticated/);
  assert.match(s, /WHERE order_id=p_order_id FOR UPDATE/);
  assert.match(s, /attempts_now >= 5/);
  assert.match(s, /interval '30 minutes'/);
  assert.match(s, /IF auth\.role\(\) <> 'service_role'/);
  assert.match(s, /auth\.uid\(\) IS DISTINCT FROM p_technician_id/);
  assert.match(s, /p_otp !~ '\^\[0-9\]\{6\}\$'/);
  assert.match(s, /service_otp_verified=true/);
});
test('reward marketing never fabricates redeemable cash or points', () => {
  const s = read('src/app/customer/loyalty/page.tsx');
  assert.match(s, /Points are not a cash balance/);
  assert.match(s, /completed and paid/);
  assert.match(s, /verified earning|Your rewards, clearly explained/);
});
