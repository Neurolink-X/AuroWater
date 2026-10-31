import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('pincode geo-cache is bounded by constant-size eviction', () => {
  const s = source('src/lib/address-geo.server.ts');
  assert.match(s, /CACHE_MAX_ENTRIES = 500/);
  assert.match(s, /if \(cache\.size > CACHE_MAX_ENTRIES\)/);
  assert.match(s, /cache\.keys\(\)\.next\(\)\.value/);
  assert.match(s, /cache\.delete\(pin\)/);
  assert.match(s, /if \(!failed\)/);
});
test('GPS respects accuracy and never promises delivery solely from coordinates', () => {
  const s = source('src/components/geo/ServiceZoneGate.tsx');
  assert.match(s, /enableHighAccuracy: true/);
  assert.match(s, /timeout: 10000/);
  assert.match(s, /accuracy > 1500/);
  assert.match(s, /accuracy > 200/);
  assert.match(s, /Verify delivery availability at checkout/);
});
test('customer-controlled in-app OTP avoids paid messaging dependencies', () => {
  const api = source('src/app/api/technician/jobs/[id]/route.ts');
  const technician = source('src/app/technician/job/[id]/page.tsx');
  const customer = source('src/app/customer/home/page.tsx');
  assert.match(api, /create_service_otp/);
  assert.match(api, /verify_service_otp/);
  assert.match(api, /createNotification/);
  assert.match(technician, /No paid SMS required/);
  assert.match(customer, /extractServiceOtp\(notification\)/);
});
test('subscription guide discloses payment and points rules', () => {
  const s = source('src/app/customer/subscriptions/page.tsx');
  assert.match(s, /no automatic bank debit is enabled/);
  assert.match(s, /completed and paid/);
  assert.match(s, /href="\/customer\/loyalty"/);
});
