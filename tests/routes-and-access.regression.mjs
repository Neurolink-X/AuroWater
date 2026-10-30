#!/usr/bin/env node
/**
 * Guards two production regressions without requiring a running app:
 * route groups must not create duplicate URL pages, and supplier dashboard
 * routes must remain protected by the proxy.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const appRoot = join(root, 'src', 'app');

function collectPages(directory, pages = []) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) collectPages(fullPath, pages);
    else if (entry === 'page.tsx') pages.push(fullPath);
  }
  return pages;
}

function routeFor(pagePath) {
  const parts = relative(appRoot, pagePath).split(sep).slice(0, -1);
  const routeParts = parts.filter((part) => !/^\(.+\)$/.test(part));
  return `/${routeParts.join('/')}`.replace(/\/$/, '') || '/';
}

const byRoute = new Map();
for (const page of collectPages(appRoot)) {
  const route = routeFor(page);
  byRoute.set(route, [...(byRoute.get(route) ?? []), relative(root, page)]);
}

const duplicates = [...byRoute.entries()].filter(([, pages]) => pages.length > 1);
assert.deepEqual(duplicates, [], `Duplicate App Router pages:\n${JSON.stringify(duplicates, null, 2)}`);

// Serviceability must fail closed when the zone lookup is unavailable; a database
// outage must never silently turn an unverified address into a bookable one.
const zonesSource = readFileSync(join(root, 'src', 'lib', 'zones.ts'), 'utf8');
assert.match(zonesSource, /status: 'LOOKUP_ERROR'/);
assert.match(zonesSource, /return lookupError\(\)/);
assert.match(zonesSource, /isPostgrestTableUnavailableError\(error\)/);

for (const [file, label] of [
  ['src/app/api/customer/serviceability/route.ts', 'customer serviceability'],
  ['src/app/api/customer/orders/route.ts', 'customer order creation'],
  ['src/app/api/admin/orders/route.ts', 'admin order creation'],
  ['src/app/api/customer/addresses/route.ts', 'customer address creation'],
]) {
  const source = readFileSync(join(root, file), 'utf8');
  assert.ok(source.includes('SERVICEABILITY_LOOKUP_FAILED'), `${label} must return a retryable error if serviceability cannot be verified`);
  assert.ok(source.includes("status === 'LOOKUP_ERROR'"), `${label} must fail closed on zone lookup failure`);
}

// Dispatch sweep observability: a successful bounded batch must disclose when queues
// may still contain work; this is a source-level guard, not a substitute for live tests.
const dispatchSweep = readFileSync(join(root, 'src', 'app', 'api', 'internal', 'technician-dispatch-sweep', 'route.ts'), 'utf8');
assert.match(dispatchSweep, /backlog_may_remain:\s*backlogMayRemain/);
assert.match(dispatchSweep, /batch_limits_hit:\s*batchLimitsHit/);
assert.match(dispatchSweep, /Object\.values\(batchLimitsHit\)\.some\(Boolean\)/);
assert.match(dispatchSweep, /one or more queues reached the per-run batch limit/);
assert.ok(dispatchSweep.includes('technician_dispatch_attempts.lt.${maxTechnicianAttempts}'), 'exhausted technician retries must not starve eligible pending jobs');

const proxySource = readFileSync(join(root, 'src', 'proxy.ts'), 'utf8');
assert.doesNotMatch(proxySource, /['"]\/supplier\/['"]/);
assert.match(proxySource, /prefix:\s*'\/supplier'/);
assert.match(proxySource, /pathname === g\.prefix \|\| pathname\.startsWith\(\`\$\{g\.prefix\}\/\`\)/);

// Pricing integrity guards: the customer API must validate and persist its own total,
// and public water-can pricing must match the API's launch rates.
const orderApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'orders', 'route.ts'), 'utf8');
assert.match(orderApi, /totalsMatch\(clientTotal, netBaseAmount, convenience, emergency_charge, gstRate, 0\.5\)/);
assert.match(orderApi, /const total = computeExpectedTotal\(netBaseAmount, convenience, emergency_charge, gstRate\)\.total/);
// Ignore legacy commented-out code when checking the active route implementation.
const activeOrderApi = orderApi
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');
assert.doesNotMatch(activeOrderApi, /const total = round2\(clientTotal\)/);

const pricingPage = readFileSync(join(root, 'src', 'app', '(public)', 'pricing', 'page.tsx'), 'utf8');
assert.match(pricingPage, /const NORMAL_RO_PRICE = 20/);
assert.match(pricingPage, /const CHILLED_RO_PRICE = 25/);
assert.match(pricingPage, /const RECURRING_RO_PRICE = 20/);
assert.match(pricingPage, /price: 'Quote required'/);


const supplierDashboard = readFileSync(join(root, 'src', 'app', 'supplier', 'dashboard', 'page.tsx'), 'utf8');
assert.ok(supplierDashboard.includes("status: needsReview ? 'review'"));
assert.ok(supplierDashboard.includes('financialsPosted = Boolean(row.financials_posted_at)'));
assert.ok(supplierDashboard.includes('!financialsPosted || !Number.isFinite(amount) || amount <= 0'));
assert.ok(supplierDashboard.includes('formatScheduledSlot(order.scheduled_slot)'));
assert.ok(!supplierDashboard.includes('canCount !== 1'));
assert.ok(supplierDashboard.includes('payment_collector: paymentCollector'));

const supplierCompletion = readFileSync(join(root, 'src', 'app', 'api', 'supplier', 'orders', '[id]', 'route.ts'), 'utf8');
assert.ok(supplierCompletion.includes("Select who collected the payment"));
assert.ok(supplierCompletion.includes('complete_supplier_order_atomic'));
assert.ok(supplierCompletion.includes('p_payment_collector: parsed.data.payment_collector'));
assert.ok(supplierCompletion.includes('p_payment_reference: reference || null'));

const adminOrderApi = readFileSync(join(root, 'src', 'app', 'api', 'admin', 'orders', '[id]', 'route.ts'), 'utf8');
assert.ok(adminOrderApi.includes('Explicitly confirm that payment was received'));
assert.ok(adminOrderApi.includes('payment_collected_by'));
assert.ok(adminOrderApi.includes('payment_collected_amount'));
assert.ok(adminOrderApi.includes('payment_collected_at'));
assert.ok(adminOrderApi.includes('Enter the UPI transaction reference'));

const supplierPayoutApi = readFileSync(join(root, 'src', 'app', 'api', 'supplier', 'payouts', 'route.ts'), 'utf8');
assert.ok(supplierPayoutApi.includes('request_supplier_payout'));
assert.ok(supplierPayoutApi.includes(".eq('user_id', auth.ctx.profile.id)"));
assert.ok(!supplierPayoutApi.includes(".eq('supplier_id'"));
assert.ok(supplierPayoutApi.includes('payout_details'));

const supplierPayoutHistory = readFileSync(join(root, 'src', 'app', 'api', 'supplier', 'earnings', 'history', 'route.ts'), 'utf8');
assert.ok(supplierPayoutHistory.includes(".eq('user_id', auth.ctx.profile.id)"));
assert.ok(supplierPayoutHistory.includes(".eq('role', 'supplier')"));
assert.ok(supplierPayoutHistory.includes('payout_details'));
assert.ok(!supplierPayoutHistory.includes(".eq('supplier_id', auth.ctx.profile.id)"));

const supplierFinanceMigration = readFileSync(join(root, 'sql', '026_supplier_finance_integrity.sql'), 'utf8');
assert.ok(supplierFinanceMigration.includes('payment_collector'));
assert.ok(supplierFinanceMigration.includes('payment_collected_by'));
assert.ok(supplierFinanceMigration.includes('payment_collected_amount'));
assert.ok(supplierFinanceMigration.includes('payment_collected_at'));
assert.ok(supplierFinanceMigration.includes('complete_supplier_order_atomic'));
assert.ok(supplierFinanceMigration.includes('SUM(o.supplier_payout)'));
assert.ok(supplierFinanceMigration.includes('pg_advisory_xact_lock'));
assert.ok(supplierFinanceMigration.includes('ORDER_EARNING'));
assert.ok(supplierFinanceMigration.includes('payee_balance(v_user_id)'));

// Versioned pricing regression guards: immutable versions, atomic publish/audit,
// server-calculated snapshots, and customer-visible rates from the same effective rule.
const pricingMigration = readFileSync(join(root, 'sql', '027_versioned_pricing_rules.sql'), 'utf8');
assert.match(pricingMigration, /CREATE TABLE IF NOT EXISTS public\.pricing_versions/);
assert.match(pricingMigration, /prevent_pricing_version_mutation/);
assert.match(pricingMigration, /prevent_order_pricing_snapshot_mutation/);
assert.match(pricingMigration, /publish_pricing_version/);
assert.match(pricingMigration, /pg_advisory_xact_lock/);
assert.match(pricingMigration, /current \u20b920 single-can supplier payout rule/);

const pricingAdminApi = readFileSync(join(root, 'src', 'app', 'api', 'admin', 'pricing', 'route.ts'), 'utf8');
assert.match(pricingAdminApi, /publish_pricing_version/);
assert.match(pricingAdminApi, /requireAdmin/);
assert.match(pricingAdminApi, /price must be between/);
assert.match(pricingAdminApi, /\['water_chilled','Chilled water',25\]/);

const pricingAdminPage = readFileSync(join(root, 'src', 'app', 'admin', 'pricing', 'page.tsx'), 'utf8');
assert.match(pricingAdminPage, /Versioned pricing/);
assert.match(pricingAdminPage, /Publish new version/);
assert.match(pricingAdminPage, /Immutable history/);

const customerPricingApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'orders', 'route.ts'), 'utf8');
assert.match(customerPricingApi, /pricing_snapshot/);
assert.match(customerPricingApi, /activePricingRow/);
assert.match(customerPricingApi, /activePricingConfig\?\.water_normal/);
assert.match(customerPricingApi, /supplier_entitlement/);

const adminCreatedOrdersApi = readFileSync(join(root, 'src', 'app', 'api', 'admin', 'orders', 'route.ts'), 'utf8');
assert.match(adminCreatedOrdersApi, /pricing_snapshot/);
assert.match(adminCreatedOrdersApi, /activePricingConfig\?\.water_normal/);

const publicSettingsApi = readFileSync(join(root, 'src', 'app', 'api', 'settings', 'route.ts'), 'utf8');
assert.match(publicSettingsApi, /pricing_versions/);
assert.match(publicSettingsApi, /pricing_version/);

const bookingWizard = readFileSync(join(root, 'src', 'components', 'booking', 'BookingWizard.tsx'), 'utf8');
assert.match(bookingWizard, /settings\.default_can_price/);
assert.match(bookingWizard, /settings\.chilled_can_price/);
assert.match(bookingWizard, /settings\.subscription_can_price/);
assert.match(bookingWizard, /settings\.bulk_can_price/);

const subscriptionCron = readFileSync(join(root, 'src', 'app', 'api', 'cron', 'subscriptions', 'route.ts'), 'utf8');
assert.match(subscriptionCron, /versioned_subscription_contract/);
assert.match(subscriptionCron, /contract_snapshot/);
assert.match(subscriptionCron, /supplier_entitlement_policy/);
assert.match(pricingMigration, /prevent_subscription_pricing_snapshot_mutation/);

const migrationBuilder = readFileSync(join(root, 'scripts', 'build-supabase-migrations.mjs'), 'utf8');
assert.match(migrationBuilder, /027_versioned_pricing_rules\.sql/);
assert.match(migrationBuilder, /026_supplier_finance_integrity\.sql/);

console.log(`Route/access, versioned pricing, and supplier finance regression checks passed (${byRoute.size} page routes).`);


// Authenticated API calls must retry once with a refreshed Supabase access token before logout.
const apiClient = readFileSync(join(root, 'src', 'lib', 'api-client.ts'), 'utf8');
assert.match(apiClient, /refreshSessionSingleFlight/);
assert.match(apiClient, /if \(refreshInFlight\) return refreshInFlight/);
assert.ok((apiClient.match(/refreshSessionSingleFlight\(\)/g) ?? []).length >= 3);
assert.ok(apiClient.includes('Do not redirect until a one-time session refresh has been attempted.'));
assert.ok(apiClient.includes('Your session could not be renewed. Please sign in again.'));

// Referral rewards regression guards: attribution, reservation, cancellation,
// and supplier payout protection.
const referralMigration = readFileSync(join(root, 'sql', '028_referral_rewards.sql'), 'utf8');
assert.ok(referralMigration.includes('CREATE TABLE IF NOT EXISTS public.referral_reward_events'));
assert.ok(referralMigration.includes('apply_referral_code'));
assert.ok(referralMigration.includes('Referral codes must be applied before your first booking'));
assert.ok(referralMigration.includes('orders_award_referral_reward'));
assert.ok(referralMigration.includes('orders_sync_referral_reward'));
assert.ok(referralMigration.includes('referral_discount_amount'));
assert.ok(referralMigration.includes('address_fingerprint'));
assert.ok(referralMigration.includes('referral_reward_once_per_address'));
assert.ok(referralMigration.includes('ORDER_EARNING'));
assert.ok(referralMigration.includes('guard_profile_referral_fields'));
assert.ok(referralMigration.includes('guard_order_referral_fields'));
assert.ok(referralMigration.includes('REVOKE INSERT, UPDATE, DELETE ON public.referral_reward_events FROM anon, authenticated'));

const customerReferralsApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'referrals', 'route.ts'), 'utf8');
assert.ok(customerReferralsApi.includes("requireRole(auth.ctx, 'customer')"));
assert.ok(customerReferralsApi.includes('apply_referral_code'));
assert.ok(customerReferralsApi.includes('reward_status'));

const customerReferralPage = readFileSync(join(root, 'src', 'app', 'customer', 'referrals', 'page.tsx'), 'utf8');
assert.ok(customerReferralPage.includes('Share invite link'));
assert.ok(customerReferralPage.includes('Apply code'));
assert.ok(customerReferralPage.includes('free_water_can'));

const referralOrderApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'orders', 'route.ts'), 'utf8');
assert.ok(referralOrderApi.includes('REFERRAL_REWARD_NOT_ELIGIBLE'));
assert.ok(referralOrderApi.includes('REFERRAL_REWARD_UNAVAILABLE'));
assert.ok(referralOrderApi.includes('referral_discount_amount'));
assert.ok(referralOrderApi.includes(".eq('reward_status', 'available')"));

assert.ok(bookingWizard.includes('Referral rewards'));
assert.ok(bookingWizard.includes('referral_reward_id'));
assert.ok(bookingWizard.includes('canRedeemReferralReward'));
assert.ok(migrationBuilder.includes('028_referral_rewards.sql'));
const orderedMigrationBundle = readFileSync(join(root, 'sql', 'ALL_MIGRATIONS_ORDERED.sql'), 'utf8');
assert.ok(orderedMigrationBundle.includes('FILE: sql/028_referral_rewards.sql'));
assert.ok(orderedMigrationBundle.includes('sync_referral_reward_order_state'));


// Location regression guards: postal lookup must stay same-origin (the production CSP
// intentionally blocks direct browser requests to third-party postal APIs), and reverse
// geocoding must not replace accurate GPS coordinates with a distant provider centroid.
const postalApi = readFileSync(join(root, 'src', 'app', 'api', 'geo', 'postal', 'route.ts'), 'utf8');
assert.match(postalApi, /from\('pincode_directory'\)/);
assert.match(postalApi, /strictCity/);
assert.doesNotMatch(bookingWizard, /https:\/\/api\.postalpincode\.in/);
assert.match(bookingWizard, /\/api\/geo\/postal\?/);
assert.match(bookingWizard, /ADDRESS_CITIES.*Noida.*Delhi/);
const reverseGeo = readFileSync(join(root, 'src', 'app', 'api', 'geocode', 'reverse', 'route.ts'), 'utf8');
assert.match(reverseGeo, /distMeters\(lat, lng, point\.lat, point\.lng\) <= 5_000/);
assert.match(reverseGeo, /const coordinateCity = regionCity\(lat, lng\)/);
assert.match(reverseGeo, /    lat,\n    lng,/);
const stagedNoidaZone = readFileSync(join(root, 'sql', '031_noida_sector_73_pilot_staged.sql'), 'utf8');
assert.match(stagedNoidaZone, /noida-sector-73-pilot/);
assert.match(stagedNoidaZone, /'COMING_SOON'/);
assert.match(stagedNoidaZone, /ARRAY\['water_can'\]::text\[\]/);
assert.match(stagedNoidaZone, /ON CONFLICT \(slug\) DO NOTHING/);
assert.match(migrationBuilder, /031_noida_sector_73_pilot_staged\.sql/);
assert.match(apiClient, /No stored Supabase session means there is no refresh token to refresh/);
// Runtime retry/cancellation behavior is covered by api-transport.unit.mjs.
assert.match(apiClient, /requestJson\(`/);
const canonicalApiClient = readFileSync(join(root, 'src', 'lib', 'api', 'client.ts'), 'utf8');
assert.match(canonicalApiClient, /requestJson\(buildApiUrl\(path\)/);

const supplierRealtime = readFileSync(join(root, 'src', 'hooks', 'useSupplierRealtime.ts'), 'utf8');
assert.match(supplierRealtime, /Safety-net polling while the tab is visible/);
assert.match(supplierRealtime, /window\.setInterval/);
assert.doesNotMatch(supplierRealtime, /if \(!supplierId \|\| status === 'live'\) return/);


// Serviceability and supplier approval regression guards:
// address book saving is separate from booking eligibility; order creation still
// validates serviceability, while dispatch must not offer work to pending/unverified suppliers.
const customerAddressApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'addresses', 'route.ts'), 'utf8');
assert.match(customerAddressApi, /Saving an address and booking a service are separate operations/);
assert.match(customerAddressApi, /serviceability\.status === 'LOOKUP_ERROR'/);
const activeAddressApi = customerAddressApi.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
assert.doesNotMatch(activeAddressApi, /status === 'NO_MATCH'/);
assert.match(customerAddressApi, /serviceability:\s*\{/);
assert.match(customerAddressApi, /serviceable: serviceability\.serviceable/);
assert.match(activeAddressApi, /resolveServiceability\(/);
assert.match(activeAddressApi, /SERVICEABILITY_LOOKUP_FAILED/);

const localIntelligenceApi = readFileSync(join(root, 'src', 'app', 'api', 'admin', 'local-intelligence', 'route.ts'), 'utf8');
assert.match(localIntelligenceApi, /\.from\('addresses'\)/);
assert.match(localIntelligenceApi, /savedAddresses/);
assert.match(localIntelligenceApi, /interestedCustomers/);
assert.match(localIntelligenceApi, /Saved-address demand signals are unavailable/);
const localIntelligencePage = readFileSync(join(root, 'src', 'app', 'admin', 'local-intelligence', 'page.tsx'), 'utf8');
assert.match(localIntelligencePage, /'Saved addresses'/);
assert.match(localIntelligencePage, /'Interested customers'/);

const dispatchApi = readFileSync(join(root, 'src', 'lib', 'dispatch.ts'), 'utf8');
assert.match(dispatchApi, /verification_status/);
assert.match(dispatchApi, /profileStatus !== 'active'/);
assert.match(dispatchApi, /verificationStatus !== 'approved'/);
assert.match(dispatchApi, /'pending_approval'/);

const activeSupplierDashboard = readFileSync(join(root, 'src', 'app', 'supplier', 'dashboard', 'page.tsx'), 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');
assert.match(activeSupplierDashboard, /Pending admin approval/);
assert.match(activeSupplierDashboard, /application_status/);
assert.match(activeSupplierDashboard, /Admin approval is required before you can receive orders/);


// Supplier dispatch recovery: prefer explicitly mapped suppliers, but allow
// same-city fallback suppliers when mapped suppliers cannot fulfil an order.
const dispatchSource = readFileSync(join(root, 'src', 'lib', 'dispatch.ts'), 'utf8');
assert.match(dispatchSource, /coverageTier - b\.coverageTier/);
assert.match(dispatchSource, /fallbackRadius = Math\.min\(20, Math\.max\(radius, radius \* 3\)\)/);
assert.match(dispatchSource, /if \(coverageTier === 1 && !sameCity\) continue/);
assert.match(dispatchSource, /eq\('key', order\.service_type\)/);

const supplierSection = readFileSync(join(root, 'src', 'app', 'supplier', '\[section\]', 'page.tsx'), 'utf8');
assert.match(supplierSection, /const POLL_MS = 10_000/);
const supplierRealtimeSource = readFileSync(join(root, 'src', 'hooks', 'useSupplierRealtime.ts'), 'utf8');
assert.match(supplierRealtimeSource, /fallbackPollMs = 10_000/);

const supplierCoverage = readFileSync(join(root, 'src', 'app', 'supplier', 'coverage', 'page.tsx'), 'utf8');
assert.match(supplierCoverage, /Requested PIN codes:/);
assert.match(supplierCoverage, /valid 6-digit PIN codes/);
assert.match(supplierCoverage, /Configured PINs:/);


// Public SEO copy must match current service coverage and avoid unverified service guarantees.
const publicHome = readFileSync(join(root, 'src', 'app', '(public)', 'page.tsx'), 'utf8');
const howItWorksPage = readFileSync(join(root, 'src', 'app', '(public)', 'how-it-works', 'page.tsx'), 'utf8');
assert.doesNotMatch(publicHome, /Now serving eligible areas[^\n]*NCR/i);
assert.doesNotMatch(publicHome, /Kanpur\s*·\s*Lucknow\s*·\s*Gorakhpur and NCR/i);
assert.match(publicHome, /Operational cities: Kanpur, Lucknow &amp; Gorakhpur/);
assert.match(publicHome, /NCR: approved PIN codes only/);
assert.match(publicHome, /Same-day Service Where Available/);
assert.doesNotMatch(publicHome, /title:\s*'Live Tracking'/);
assert.doesNotMatch(publicHome, /Real-time updates from booking/i);
assert.doesNotMatch(publicHome, /Book by 2 PM, get service today in most areas/i);
assert.doesNotMatch(publicHome, /100% Sealed & Hygienic/i);
assert.match(publicHome, /Order Updates/);
assert.match(howItWorksPage, /Timing and fulfilment depend on local availability/);
assert.doesNotMatch(howItWorksPage, /live tracking, zero surprises/i);


// CI regression coverage: offline retry remains self-contained and blocking lint patterns stay fixed.
const retryButton = readFileSync(join(root, 'src', 'app', 'offline', 'RetryButton.tsx'), 'utf8');
assert.doesNotMatch(retryButton, /from ['"]\.\/connection['"]/);
const pricingService = readFileSync(join(root, 'src', 'lib', 'services', 'pricing.service.ts'), 'utf8');
assert.doesNotMatch(pricingService, /queryOne<any>/);
const pricingVisualizer = readFileSync(join(root, 'src', 'app', 'pricing', 'visualizer', 'page.tsx'), 'utf8');
assert.doesNotMatch(pricingVisualizer, /<p[^>]*>\s*\/\//);


// Supplier UX regression: background/manual refresh preserves loaded content and Orders stays prominent.
const supplierNav = readFileSync(join(root, 'src', 'components', 'supplier', 'SupplierNav.tsx'), 'utf8');
assert.match(supplierNav, /href: '\/supplier\/orders', label: 'Orders', priority: true/);
assert.match(supplierNav, /data-priority/);
const supplierSectionPage = readFileSync(join(root, 'src', 'app', 'supplier', '[section]', 'page.tsx'), 'utf8');
assert.match(supplierSectionPage, /First load may use a skeleton; refreshes keep the current section visible/);
assert.match(supplierSectionPage, /if \(!silent && !hasData\.current\) setLoading\(true\)/);
assert.match(supplierSectionPage, /id === latest\.current && !silent/);
assert.match(supplierSectionPage, /disabled=\{busy \|\| \(loading && !hasData\.current\)\}/);


// Profile support errors must explain that failed submissions do not update records.
const supplierProfileApi = readFileSync(join(root, 'src', 'app', 'api', 'supplier', 'profile', 'route.ts'), 'utf8');
assert.match(supplierProfileApi, /No changes were submitted/);
const supplierProfilePage = readFileSync(join(root, 'src', 'app', 'supplier', 'profile', 'page.tsx'), 'utf8');
assert.match(supplierProfilePage, /verification_status/);
assert.match(supplierProfilePage, /postal-code/);


// Supplier/technician workflow regressions: avoid duplicate mobile navigation,
// keep language selection shared across role pages, and only reveal precise
// supplier navigation after the order is accepted.
const supplierProfileRoute = readFileSync(join(root, 'src', 'app', 'api', 'supplier', 'profile', 'route.ts'), 'utf8');
assert.match(supplierProfileRoute, /\.select\('\*'\)\.eq\('id', supplierId\)\.maybeSingle\(\)/);
assert.match(supplierProfileRoute, /profile read failed/);
assert.match(supplierProfileRoute, /No changes were submitted/);

assert.match(supplierNav, /LanguageToggle/);
assert.match(supplierNav, /useLanguage/);
assert.match(supplierNav, /href: '\/supplier\/coverage', label: 'Service Areas'/);
assert.match(supplierSectionPage, /useLanguage\(\)/);
const activeSupplierSection = supplierSectionPage.split("\n// 'use client'")[0];
assert.doesNotMatch(activeSupplierSection, /<nav className="sp-nav"/);
assert.match(supplierSectionPage, /sp-head-row/);
assert.match(supplierSectionPage, /const canNavigate = Boolean\(deliveryAddress.*acceptedFlag/s);
assert.match(supplierSectionPage, /google\.com\/maps\/dir/);
assert.match(supplierSectionPage, /language === 'hi' \? 'डिलीवरी शुरू करें'/);

const supplierNavSource = readFileSync(join(root, 'src', 'components', 'supplier', 'SupplierNav.tsx'), 'utf8');
assert.match(supplierNavSource, /LanguageToggle/);
assert.match(supplierNavSource, /Service Areas/);
assert.match(supplierNavSource, /overflow-x: auto/);

const technicianDashboard = readFileSync(join(root, 'src', 'app', 'technician', 'dashboard', 'page.tsx'), 'utf8');
assert.match(technicianDashboard, /useLanguage/);
assert.doesNotMatch(technicianDashboard, /usePersisted<'en' \| 'hi'>\(KEYS\.LANGUAGE/);
const technicianJobs = readFileSync(join(root, 'src', 'app', 'technician', 'jobs', 'page.tsx'), 'utf8');
assert.match(technicianJobs, /LanguageToggle/);
assert.match(technicianJobs, /View complete job/);
const technicianJobDetail = readFileSync(join(root, 'src', 'app', 'technician', 'job', '\[id\]', 'page.tsx'), 'utf8');
assert.match(technicianJobDetail, /LanguageToggle/);
assert.match(technicianJobDetail, /google\.com\/maps\/dir/);


// Supplier portal UX regressions: one shared language preference and no blanking
// of already-loaded orders while a refresh is in progress.
const supplierDashboardI18n = readFileSync(join(root, 'src', 'app', 'supplier', 'dashboard', 'page.tsx'), 'utf8');
const supplierDashboardSharedI18n = supplierDashboardI18n.slice(supplierDashboardI18n.indexOf("\n'use client';") + 1);
assert.match(supplierDashboardSharedI18n, /useLanguage\(\)/);
assert.doesNotMatch(supplierDashboardSharedI18n, /aurotap_supplier_language/);
assert.doesNotMatch(supplierDashboardSharedI18n, /Dashboard language \/ डैशबोर्ड की भाषा/);
assert.match(supplierDashboardSharedI18n, /ordersLoadedOnceRef/);
assert.match(supplierDashboardSharedI18n, /dashboardLoadedOnceRef/);
assert.match(supplierDashboardSharedI18n, /if \(!dashboardLoadedOnceRef\.current\) setLoading\(true\)/);
assert.match(supplierDashboardSharedI18n, /if \(!ordersLoadedOnceRef\.current\) setLoadingOrders\(true\)/);
assert.match(supplierDashboardSharedI18n, /ordersLoadedOnceRef\.current = true/);

const supplierSectionSupportPage = readFileSync(join(root, 'src', 'app', 'supplier', '[section]', 'page.tsx'), 'utf8');
assert.match(supplierSectionSupportPage, /Troubleshoot missing orders/);
assert.match(supplierSectionSupportPage, /What to include in a support request/);
assert.match(supplierSectionSupportPage, /This page does not create a support ticket automatically/);
assert.match(supplierSectionSupportPage, /const hiLabels: Record<string, string>/);

const adminLoginPage = readFileSync(join(root, 'src', 'app', 'admin', 'login', 'page.tsx'), 'utf8');
assert.match(adminLoginPage, /rawReturnTo\.startsWith\('\/admin\/'\)/);
assert.match(adminLoginPage, /window\.location\.replace\(returnTo\)/);

const adminShellPage = readFileSync(join(root, 'src', 'components', 'admin', 'AdminShell.tsx'), 'utf8');
assert.match(adminShellPage, /let active = true/);
assert.match(adminShellPage, /String\(verified\.user\.role\)\.toUpperCase\(\) !== 'ADMIN'/);
assert.match(adminShellPage, /\/admin\/login\?returnTo=/);


// Technician job updates should be event-driven with a bounded polling fallback.
// Realtime is an accelerator, never the sole source of truth.
const technicianJobsPage = readFileSync(join(root, 'src', 'app', 'technician', 'jobs', 'page.tsx'), 'utf8');
assert.match(technicianJobsPage, /\.channel\(\`technician-jobs-\$\{currentUser\.id\}\`\)/);
assert.match(technicianJobsPage, /table: 'orders'/);
assert.match(technicianJobsPage, /filter: \`technician_id=eq\.\$\{currentUser\.id\}\`/);
assert.match(technicianJobsPage, /setInterval\(\(\) => \{/);
assert.match(technicianJobsPage, /window\.removeEventListener\('online', onOnline\)/);
assert.match(technicianJobsPage, /supabase\.removeChannel\(channel\)/);


// Subscription loyalty: additive schema, server-side paid-renewal awards, and admin-only controls.
const loyaltyMigration = readFileSync(join(root, 'sql', '032_subscription_loyalty_rewards.sql'), 'utf8');
assert.ok(loyaltyMigration.includes('subscription_loyalty_events'));
assert.ok(loyaltyMigration.includes('orders_award_subscription_loyalty'));
assert.ok(loyaltyMigration.includes("coalesce(NEW.payment_status, '')) <> 'paid'"));
assert.ok(loyaltyMigration.includes("'streak_bonus'"));
assert.ok(loyaltyMigration.includes('subscription_loyalty_points_per_renewal'));
const loyaltyAdminApi = readFileSync(join(root, 'src', 'app', 'api', 'admin', 'settings', 'route.ts'), 'utf8');
assert.ok(loyaltyAdminApi.includes('subscription_loyalty_points_per_renewal'));
assert.ok(loyaltyAdminApi.includes('subscription_loyalty_enabled'));
const loyaltyAdminPage = readFileSync(join(root, 'src', 'app', 'admin', 'loyalty', 'page.tsx'), 'utf8');
assert.ok(loyaltyAdminPage.includes('/api/admin/settings'));
assert.ok(loyaltyAdminPage.includes('Save loyalty settings'));
const customerLoyaltyApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'loyalty', 'route.ts'), 'utf8');
assert.ok(customerLoyaltyApi.includes("requireRole(auth.ctx, 'customer')"));
assert.ok(customerLoyaltyApi.includes('points_balance'));
assert.ok(migrationBuilder.includes('032_subscription_loyalty_rewards.sql'));


// Subscription loyalty regression guards: ledger balance must be lifetime-based,
// offers must be admin-controlled, and redemption endpoints must be server-validated.
const loyaltyMigrationBase = readFileSync(join(root, 'sql', '032_subscription_loyalty_rewards.sql'), 'utf8');
const loyaltyRedemptionMigration = readFileSync(join(root, 'sql', '033_subscription_loyalty_redemption.sql'), 'utf8');
assert.match(loyaltyMigrationBase, /streak_bonus > 0/);
assert.match(loyaltyMigrationBase, /subscription_loyalty_events/);
assert.match(loyaltyRedemptionMigration, /subscription_loyalty_balance/);
assert.match(loyaltyRedemptionMigration, /pg_advisory_xact_lock/);
assert.match(loyaltyRedemptionMigration, /reserve_subscription_loyalty_redemption/);
assert.match(loyaltyRedemptionMigration, /reverse_subscription_loyalty_redemption/);
assert.match(loyaltyRedemptionMigration, /finalize_subscription_loyalty_redemption/);
assert.match(loyaltyRedemptionMigration, /p_points <> v_target/);
assert.match(loyaltyRedemptionMigration, /p_discount > round\(p_base_amount \* v_max_discount \/ 100\.0, 2\)/);
assert.match(loyaltyRedemptionMigration, /subscription_loyalty_reversal_source_unique/);
assert.match(loyaltyRedemptionMigration, /metadata->>'status' = 'reserved' AND order_id IS NULL/);
assert.match(loyaltyRedemptionMigration, /IF NOT v_enabled THEN/);
assert.match(loyaltyRedemptionMigration, /IF NOT v_free_enabled/);
assert.match(loyaltyRedemptionMigration, /IF NOT v_service_enabled/);

const loyaltyOrdersApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'orders', 'route.ts'), 'utf8');
assert.match(loyaltyOrdersApi, /loyalty_redemption_type/);
assert.match(loyaltyOrdersApi, /reserve_subscription_loyalty_redemption/);
assert.match(loyaltyOrdersApi, /finalize_subscription_loyalty_redemption/);
assert.match(loyaltyOrdersApi, /reverse_subscription_loyalty_redemption/);
assert.match(loyaltyOrdersApi, /REWARD_COMBINATION_NOT_ALLOWED/);
assert.match(loyaltyOrdersApi, /LOYALTY_POINTS_INSUFFICIENT/);
assert.match(loyaltyOrdersApi, /LOYALTY_FINALIZATION_FAILED/);
assert.match(loyaltyOrdersApi, /PRICE_CHANGED/);
assert.match(loyaltyOrdersApi, /isChilledOrder \|\| qty !== 1/);

const loyaltyCustomerApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'loyalty', 'route.ts'), 'utf8');
assert.match(loyaltyCustomerApi, /subscription_loyalty_balance/);
assert.match(loyaltyCustomerApi, /history_limit: 100/);
const loyaltyAdminPageRegression = readFileSync(join(root, 'src', 'app', 'admin', 'loyalty', 'page.tsx'), 'utf8');
assert.match(loyaltyAdminPageRegression, /subscription_loyalty_free_can_enabled/);
assert.match(loyaltyAdminPageRegression, /subscription_loyalty_service_discount_enabled/);
const loyaltyBooking = readFileSync(join(root, 'src', 'components', 'booking', 'BookingWizard.tsx'), 'utf8');
assert.match(loyaltyBooking, /loyalty_redemption_type:/);
assert.match(loyaltyBooking, /AuroTap loyalty rewards/);
assert.match(loyaltyBooking, /selectedLoyaltyReward/);
const loyaltyCustomerHome = readFileSync(join(root, 'src', 'app', 'customer', 'home', 'page.tsx'), 'utf8');
assert.match(loyaltyCustomerHome, /href="\/customer\/loyalty"/);
assert.match(loyaltyCustomerHome, /Subscription rewards/);
const loyaltyCustomerAccount = readFileSync(join(root, 'src', 'app', 'customer', 'account', 'page.tsx'), 'utf8');
assert.match(loyaltyCustomerAccount, /href="\/customer\/loyalty"/);
const loyaltyAdminSettings = readFileSync(join(root, 'src', 'app', 'admin', 'settings', 'page.tsx'), 'utf8');
assert.match(loyaltyAdminSettings, /href="\/admin\/loyalty"/);

assert.match(migrationBuilder, /033_subscription_loyalty_redemption\.sql/);
