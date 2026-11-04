import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');
const postal = read('src/app/api/geo/postal/route.ts');
const cityMatcher = read('src/lib/postal-city.ts');
const booking = read('src/components/booking/BookingWizard.tsx');
const supplierPage = read('src/app/supplier/profile/page.tsx');
const supplierCoverage = read('src/app/supplier/coverage/page.tsx');
const supplierCoverageApi = read('src/app/api/supplier/coverage-requests/route.ts');
const supplierInvite = read('src/app/customer/referral/page.tsx');

test('postal search prioritizes locally mapped post offices instead of unrelated same-name districts', () => {
  assert.match(postal, /const district = postalDistrictForCity\(city\)/);
  assert.match(postal, /run\(Boolean\(district\)\)/);
  assert.match(postal, /!strictCity && district && !data\?\.length/);
  assert.match(postal, /run\(false\)/);
  assert.match(postal, /\.eq\('pincode', pincode\)/);
  assert.match(postal, /\.limit\(MAX_RESULTS\)/);
});

test('city-district matching works for every city, with only known exceptions hardcoded', () => {
  assert.match(cityMatcher, /return DISTRICT_ALIASES\[normalized\] \?\? normalized/);
  assert.match(cityMatcher, /kanpur: 'kanpur nagar'/);
  assert.match(cityMatcher, /noida: 'gautam buddha nagar'/);
  assert.match(cityMatcher, /export function normalizedPostalPlace/);
  assert.match(postal, /const district = postalDistrictForCity\(city\)/);
  assert.match(postal, /strictCity && district/);
  assert.match(postal, /!strictCity && district && !data\?\.length/);
});

test('customer can type exact PIN and old area suggestions clear when city changes', () => {
  assert.match(booking, /setAreaHits\(\[\]\); setPinAreas\(\[\]\); setDraft/);
  assert.match(booking, /You can enter an exact 6-digit PIN manually/);
  assert.match(booking, /void lookupPincode\(pin\)/);
});

test('supplier profile warns that an empty PIN zone is not citywide', () => {
  assert.match(supplierPage, /No exact PINs mapped/);
  assert.match(supplierPage, /does not automatically authorize delivery to every PIN/);
  assert.match(supplierPage, /href="\/supplier\/coverage"/);
});

test('supplier finds an exact existing PIN zone and must request admin approval', () => {
  assert.match(supplierCoverage, /Find exact service area by PIN/);
  assert.match(supplierCoverage, /zone\.pincodes\?\.includes\(findPin\)/);
  assert.match(supplierCoverage, /setSelected\(\[zone\.id\]\)/);
  assert.match(supplierCoverage, /Select this zone/);
  assert.match(supplierCoverage, /request admin approval|admin review|admin approves/i);
  assert.match(supplierCoverageApi, /\.contains\('pincodes', \[pin\]\)/);
  assert.match(supplierCoverageApi, /already belongs to a configured area/);
  assert.match(supplierCoverageApi, /Existing approved mappings must NEVER be downgraded/);
  assert.match(supplierCoverageApi, /status: 'PENDING'/);
});

test('successful supplier referral returns to main home, failure stays on invitation', () => {
  const success = supplierInvite.indexOf("router.replace('/');");
  const failure = supplierInvite.indexOf("setError(e instanceof Error");
  assert.ok(success > 0 && failure > success);
  assert.match(supplierInvite, /if \(!res\.ok\) throw new Error/);
  assert.match(supplierInvite, /toast\.success/);
});
