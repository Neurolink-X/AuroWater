import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(join(process.cwd(), path), 'utf8');
const policy = read('src/lib/supplier-radius-policy.ts');
const api = read('src/app/api/supplier/settings/route.ts');
const settings = read('src/app/(supplier)/supplier/settings/page.tsx');
const dispatch = read('src/app/supplier/[section]/page.tsx');
const registration = read('src/lib/auth/seed-supplier-registration.ts');

test('supplier radius policy uses one shared 10km default with 50km maximum', () => {
  assert.match(policy, /default: 10/);
  assert.match(policy, /max: 50/);
  assert.match(policy, /selfServeMax: 30/);
  assert.match(api, /supplierRadiusRequiresApproval/);
  assert.match(api, /radius_confirmed/);
  assert.match(registration, /zone_radius_km: SUPPLIER_RADIUS.default/);
});
test('both supplier controls share policy, confirmation and server field', () => {
  for (const source of [settings, dispatch]) {
    assert.match(source, /SUPPLIER_RADIUS.max/);
    assert.match(source, /supplierRadiusRequiresConfirmation/);
    assert.match(source, /zone_radius_km/);
  }
});
test('private registered email appears in both supplier profile surfaces', () => {
  assert.match(api, /auth.ctx.user.email/);
  assert.match(settings, /snap\?\.profile\?\.email/);
  assert.match(dispatch, /profile.email/);
});
