import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const rates = read('src/lib/booking-pricing.ts');
const panel = read('src/app/admin/pricing/page.tsx');
const legacy = read('src/app/admin/settings/page.tsx');
const legacyApi = read('src/app/api/admin/settings/route.ts');
const endpoint = read('src/app/api/admin/pricing/route.ts');
const guard = read('sql/pricing_version_floor_guard_20261031.sql');
assert.match(rates, /subscription: 20/);
assert.match(rates, /SHOW_MARKET_COMPARISON = false/);
assert.match(panel, /Chilled RO · ₹\/can'.*?,25,500/);
assert.match(panel, /Discard draft/);
assert.match(panel, /Remove city override from draft/);
assert.match(legacy, /ENFORCE_LAUNCH_PRICING = false/);
assert.match(legacy, /if \(LOCKED_KEYS\.has\(key\)\) continue/);
assert.match(legacy, /href="\/admin\/pricing"/);
assert.match(legacyApi, /versionedPriceKeys/);
assert.match(legacyApi, /return jsonErr\([\s\S]*?Admin → Pricing[\s\S]*?409/);
assert.match(endpoint, /seenCities\.has\(city\)/);
assert.match(guard, /pricing_version_floor_guard/);
assert.match(guard, /water_chilled'\)::numeric, -1\) < 25/);
assert.match(guard, /NEW\.config -> 'city_overrides'/);

const publicSettings = read('src/app/api/settings/route.ts');
const orderApi = read('src/app/api/customer/orders/route.ts');
const booking = read('src/components/booking/BookingWizard.tsx');
const settingsHook = read('src/hooks/useSettings.ts');
const servicePrice = read('src/components/services/ServicePrice.tsx');
const resolver = read('src/lib/pricing/resolve-effective.ts');
// Regression gates: all monetary surfaces must resolve the same published version.
assert.match(publicSettings, /resolveEffectivePriceBook\(activeVersion\.config, req\.nextUrl\.searchParams\.get\('city'\)\)/);
assert.match(orderApi, /resolveEffectivePriceBook\(publishedPricingConfig, a\.city\)/);
assert.match(orderApi, /pricing_version: Number\(activePricingRow\.version\)/);
assert.match(booking, /useSettings\(undefined, pricingCity\)/);
assert.match(booking, /settings\.service_base_prices\[`water_tanker_\$\{o\.key\}`\]/);
assert.match(settingsHook, /aw_pricing_published_at/);
assert.match(servicePrice, /useSettings\(undefined, city\)/);
assert.doesNotMatch(read('src/app/(public)/pricing/PricingClient.tsx'), /const SUPPORTED_CITIES =/);
assert.match(resolver, /services: \{ \.\.\.globalServices, \.\.\.cityServices \}/);
assert.match(orderApi, /TANKER_QUOTE_REQUIRED/);
// Pricing changes are versioned; never silently reprice completed orders.
assert.match(endpoint, /publish_pricing_version/);
console.log('Published price, city override, booking total, and quote guards verified.');

console.log('Centralized pricing policy and admin control regression checks passed.');
