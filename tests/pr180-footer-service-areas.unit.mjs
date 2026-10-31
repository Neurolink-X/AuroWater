import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const footer = read('src/components/layout/Footer.tsx');
const directory = read('src/lib/public-city-directory.ts');
const areas = read('src/app/(public)/service-areas/page.tsx');
const waitlist = read('src/components/public/NcrWaitlistForm.tsx');
const waitlistApi = read('src/app/api/waitlist/route.ts');
const cityApi = read('src/app/api/cities/route.ts');
const admin = read('src/app/api/admin/cities/route.ts');

test('compact footer does not retain the previous oversized stylesheet', () => {
  assert.doesNotMatch(footer, /\.ft-main-grid/);
  assert.doesNotMatch(footer, /ft-trust-badges/);
});
test('footer includes only one navigation section for general links', () => {
  assert.match(footer, /Footer navigation/);
  assert.match(footer, /Explore AuroTap/);
});
test('footer has a single row for policies at the bottom', () => {
  assert.match(footer, /aria-label="Policies"/);
  assert.match(footer, /border-t border-white\/10 pt-4/);
});
test('footer has bounded top and bottom padding on mobile', () => {
  assert.match(footer, /pb-6 pt-8 sm:px-6 sm:pb-7 sm:pt-10/);
});
test('footer city list is capped to prevent future uncontrolled growth', () => {
  assert.match(footer, /selectFooterCities\(cities, 6, 2\)/);
});
test('overflow city list provides a link to the whole directory', () => {
  assert.match(footer, /Explore all cities/);
  assert.match(footer, /groups\.remaining > 0/);
});
test('footer city activation is based on existing canonical city directory', () => {
  assert.match(footer, /fetch\('\/api\/cities'/);
  assert.doesNotMatch(footer, /fetch\('\/api\/public\/service-cities'/);
});
test('footer cleans up its fetch after navigation', () => {
  assert.match(footer, /controller\.abort\(\)/);
});
test('footer preserves fallback if city API fails', () => {
  assert.match(footer, /mergePublicCityDirectory\(\[\], FALLBACK_CITIES\)/);
});
test('footer supports upcoming cities without implying availability', () => {
  assert.match(footer, /'coming_soon'/);
  assert.match(footer, /Coming soon/);
});
test('footer links to book water directly', () => {
  assert.match(footer, /href="\/book\?service=water_can"/);
});
test('footer links to WhatsApp with safe external-link attributes', () => {
  assert.match(footer, /rel="noopener noreferrer"/);
});
test('footer navigation is structured semantically for accessible use', () => {
  assert.match(footer, /<nav aria-label="Footer navigation"/);
  assert.match(footer, /<nav aria-label="Policies"/);
});
test('footer cards are not fixed-width boxes', () => {
  assert.match(footer, /flex flex-wrap gap-2/);
});
test('directory normalizes city names before display', () => {
  assert.match(directory, /normalize\('NFKC'\)/);
});
test('directory rejects malformed or unsafe city names', () => {
  assert.match(directory, /name\.length > 80/);
  assert.match(directory, /SLUG\.test\(slug\)/);
});
test('directory never overwrites an admin-managed city with a fallback', () => {
  assert.match(directory, /if \(city && !directory\.has\(city\.slug\)\)/);
});
test('directory distinguishes active and upcoming for footer', () => {
  assert.match(directory, /city\.status === 'active'/);
  assert.match(directory, /city\.status !== 'active'/);
});
test('service areas page fetches cities from canonical database', () => {
  assert.match(areas, /getPublicServiceCities\(\)/);
  assert.match(read('src/lib/public-city-directory.server.ts'), /\.from\('cities'\)/);
});
test('service areas page has no hardcoded Kanpur/Noida-only grid', () => {
  assert.match(areas, /cities\.filter\(city => city\.status === 'active'\)/);
  assert.match(areas, /cities\.filter\(city => city\.status !== 'active'\)/);
  assert.doesNotMatch(areas, /NCR_EXPANSION_REGIONS/);
});
test('service areas page renders both active and future cities', () => {
  assert.match(areas, /Active service cities/);
  assert.match(areas, /Upcoming and waitlist cities/);
});
test('service areas page does not equate city activation with universal availability', () => {
  assert.match(areas, /Check availability/);
  assert.match(areas, /address, PIN code/);
});
test('service areas page includes all-city expansion waitlist', () => {
  assert.match(areas, /<NcrWaitlistForm cities=\{cities\.map/);
});
test('service areas page uses a canonical SEO URL', () => {
  assert.match(areas, /canonical: '\/service-areas'/);
});
test('waitlist selector is data-driven, not static NCR-only', () => {
  assert.match(waitlist, /cities = \[\]/);
  assert.match(waitlist, /upcoming = cities\.filter/);
  assert.doesNotMatch(waitlist, /const CITIES = \['Delhi'/);
});
test('waitlist accepts other cities', () => {
  assert.match(waitlist, /'Other city'/);
  assert.match(waitlist, /otherCity\.trim\(\)/);
});
test('waitlist remains honeypot-protected', () => {
  assert.match(waitlist, /website/);
  assert.match(waitlistApi, /Honeypot/);
});
test('waitlist API explicitly accepts the new service areas source', () => {
  assert.match(waitlistApi, /'service-areas'/);
});
test('canonical city API remains public without privileged role keys', () => {
  assert.match(cityApi, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(cityApi, /SUPABASE_SERVICE_ROLE_KEY/);
});
test('admin city activation requires verified operational capacity', () => {
  assert.match(admin, /approved, online supplier with available stock/);
});

test('water delivery city index uses shared admin-driven directory', () => {
  const page = read('src/app/(public)/water-delivery/page.tsx');
  assert.match(page, /getPublicServiceCities\(\)/);
  assert.match(page, /cities\.filter\(\(city\) => city\.status === 'active'\)/);
});
test('new active cities lead to booking rather than a nonexistent SEO slug', () => {
  const page = read('src/app/(public)/water-delivery/page.tsx');
  assert.match(page, /DETAILED_CITY_PAGES\.has\(city\.slug\)/);
  assert.match(page, /'\/book\?service=water_can'/);
});
test('public server directory reads only safe city columns', () => {
  const helper = read('src/lib/public-city-directory.server.ts');
  assert.match(helper, /select\('id,name,slug,status,is_featured,sort_order'\)/);
  assert.match(helper, /from\('cities'\)/);
  assert.doesNotMatch(helper, /supplier_stock|profiles|wallet_ledger/);
});
test('water delivery city index sends unlisted visitors to the expansion waitlist', () => {
  const page = read('src/app/(public)/water-delivery/page.tsx');
  assert.match(page, /href="\/service-areas#join-waitlist"/);
});
