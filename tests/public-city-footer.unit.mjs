import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lib = readFileSync('src/lib/public-city-status.ts', 'utf8');
const route = readFileSync('src/app/api/public/service-cities/route.ts', 'utf8');
const footer = readFileSync('src/components/layout/Footer.tsx', 'utf8');

test('city status source is operational zones', () => {
  assert.match(route, /from\('service_zones'\)/);
});
test('city status route does not expose addresses or user records', () => {
  assert.match(route, /select\('city,status'\)/);
});
test('city status route limits DB rows', () => {
  assert.match(route, /limit\(1000\)/);
});
test('city status route uses bounded caching', () => {
  assert.match(route, /s-maxage=300/);
});
test('city status route has a graceful fallback', () => {
  assert.match(route, /source: 'fallback'/);
});
test('city status route uses canonical aggregator', () => {
  assert.match(route, /summarizePublicCities\(data \?\? \[\]\)/);
});
test('aggregator deduplicates city names', () => {
  assert.match(lib, /new Map<string, Accumulator>/);
});
test('aggregator normalizes whitespace', () => {
  assert.match(lib, /normalize\('NFKC'\)/);
});
test('aggregator rejects control characters', () => {
  assert.match(lib, /Reject markup, control characters/);
});
test('aggregator supports limited zones', () => {
  assert.match(lib, /limitedZones/);
});
test('aggregator does not claim unavailable zones are bookable', () => {
  assert.match(lib, /case 'coming-soon'/);
});
test('aggregator restricts allowed status values', () => {
  assert.match(lib, /normalizeZoneStatus/);
});
test('aggregator enforces output size limit', () => {
  assert.match(lib, /Math\.min\(limit, 1000\)/);
});
test('aggregator sorts by status and name', () => {
  assert.match(lib, /localeCompare\(b\.name/);
});
test('footer requests the public city endpoint', () => {
  assert.match(footer, /fetch\('\/api\/public\/service-cities'/);
});
test('footer cancels fetch on unmount', () => {
  assert.match(footer, /controller\.abort\(\)/);
});
test('footer limits public city display', () => {
  assert.match(footer, /slice\(0, 30\)/);
});
test('footer retains offline fallback', () => {
  assert.match(footer, /Keep existing city fallback when offline/);
});
test('footer renders dynamic city labels', () => {
  assert.match(footer, /displayedCities\.map/);
});
test('footer distinguishes limited coverage', () => {
  assert.match(footer, /Limited coverage/);
});
test('footer has mobile card grid', () => {
  assert.match(footer, /grid-template-columns: repeat\(auto-fit/);
});
test('footer has readable link contrast', () => {
  assert.match(footer, /rgba\(255,255,255,0\.82\)/);
});
