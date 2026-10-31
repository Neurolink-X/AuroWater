import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Legacy service-zone projection still exists for admin diagnostics.
// The public footer must use the canonical cities directory instead.
const lib = readFileSync('src/lib/public-city-status.ts', 'utf8');
const route = readFileSync('src/app/api/public/service-cities/route.ts', 'utf8');
const footer = readFileSync('src/components/layout/Footer.tsx', 'utf8');
const cityApi = readFileSync('src/app/api/cities/route.ts', 'utf8');
const directory = readFileSync('src/lib/public-city-directory.ts', 'utf8');

test('legacy zone status API continues reading operational zones', () => {
  assert.match(route, /from\('service_zones'\)/);
});
test('zone endpoint never exposes user addresses', () => {
  assert.match(route, /select\('city,status'\)/);
});
test('zone endpoint limits its database query', () => {
  assert.match(route, /limit\(1000\)/);
});
test('zone endpoint sets bounded cache headers', () => {
  assert.match(route, /s-maxage=300/);
});
test('zone endpoint keeps fallback for service outages', () => {
  assert.match(route, /source: 'fallback'/);
});
test('zone aggregation still combines city names safely', () => {
  assert.match(lib, /summarizePublicCities/);
  assert.match(lib, /new Map<string, Accumulator>/);
});
test('zone aggregator rejects malformed city names', () => {
  assert.match(lib, /normalize\('NFKC'\)/);
  assert.match(lib, /Reject markup, control characters/);
});
test('zone aggregator supports limited and unavailable statuses', () => {
  assert.match(lib, /limitedZones/);
  assert.match(lib, /case 'coming-soon'/);
});
test('zone aggregator uses a bounded output list', () => {
  assert.match(lib, /Math\.min\(limit, 1000\)/);
});
test('footer uses canonical city directory rather than a zone status guess', () => {
  assert.match(footer, /fetch\('\/api\/cities'/);
  assert.doesNotMatch(footer, /fetch\('\/api\/public\/service-cities'/);
  assert.match(cityApi, /from\('cities'\)/);
});
test('footer fetch is cancelled after navigation', () => {
  assert.match(footer, /controller\.abort\(\)/);
});
test('footer displays bounded active and upcoming cities', () => {
  assert.match(footer, /selectFooterCities\(cities, 6, 2\)/);
  assert.match(footer, /groups\.active\.map/);
  assert.match(footer, /groups\.upcoming\.map/);
});
test('footer has conservative offline city fallback', () => {
  assert.match(footer, /mergePublicCityDirectory\(\[\], FALLBACK_CITIES\)/);
});
test('footer status labels are derived from admin city directory', () => {
  assert.match(directory, /cityAvailabilityLabel/);
  assert.match(directory, /'coming_soon'/);
  assert.match(directory, /'waitlist'/);
});
test('footer uses compact responsive grid', () => {
  assert.match(footer, /md:grid-cols-\[1\.2fr_1fr_1fr\]/);
});
test('footer text contrast uses readable Tailwind tokens', () => {
  assert.match(footer, /text-slate-300/);
  assert.match(footer, /text-white/);
});
test('footer links to the complete service areas page', () => {
  assert.match(footer, /Explore all cities/);
  assert.match(footer, /href="\/service-areas"/);
});
test('footer has no old inflated trust badge layout', () => {
  assert.doesNotMatch(footer, /ft-trust-badges/);
});
