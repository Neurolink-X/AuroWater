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

const proxySource = readFileSync(join(root, 'src', 'proxy.ts'), 'utf8');
assert.doesNotMatch(proxySource, /['"]\/supplier\/['"]/);
assert.match(proxySource, /prefix:\s*'\/supplier'/);
assert.match(proxySource, /pathname === g\.prefix \|\| pathname\.startsWith\(\`\$\{g\.prefix\}\/\`\)/);

// Pricing integrity guards: the customer API must validate and persist its own total,
// and public water-can pricing must match the API's launch rates.
const orderApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'orders', 'route.ts'), 'utf8');
assert.match(orderApi, /totalsMatch\(clientTotal, netBaseAmount, convenience, emergency_charge, gstRate, 0\.5\)/);
assert.match(orderApi, /const total = computeExpectedTotal\(base_amount, convenience, emergency_charge, gstRate\)\.total/);
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
assert.match(pricingAdminApi, /price must be between \u20b920 and \u20b9500/);

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
assert.ok(apiClient.includes('await supabase.auth.refreshSession()'));
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
