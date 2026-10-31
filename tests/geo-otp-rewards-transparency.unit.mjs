import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('pincode centroid cache stays bounded and supports stale expiration', () => {
  const geo = source('src/lib/address-geo.server.ts');
  assert.match(geo, /MAX_CACHED_PIN_CENTROIDS = 512/);
  assert.match(geo, /cache\.size > MAX_CACHED_PIN_CENTROIDS/);
  assert.match(geo, /cache\.delete\(oldest\)/);
  assert.match(geo, /if \(hit\) cache\.delete\(pin\)/);
  assert.match(geo, /if \(!failed\)/);
  assert.match(geo, /PIN_MISMATCH_KM = 15/);
});
test('service code uses existing in-app notifications, never claims SMS', () => {
  const api = source('src/app/api/technician/jobs/[id]/route.ts');
  const screen = source('src/app/technician/job/[id]/page.tsx');
  assert.match(api, /rpc\('create_service_otp'/);
  assert.match(api, /createNotification\(/);
  assert.match(api, /rpc\('verify_service_otp'/);
  assert.match(screen, /in-app notifications/);
  assert.match(screen, /Do not ask for their login OTP/);
});
test('rewards and subscriptions do not imply instant unearned rewards or autopay', () => {
  assert.match(source('src/app/customer/loyalty/page.tsx'), /completed and paid subscription renewals earn points/);
  assert.match(source('src/app/customer/subscriptions/page.tsx'), /No hidden subscription debit/);
});
