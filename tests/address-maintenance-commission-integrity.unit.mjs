import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(path, 'utf8');
const orders = source('src/app/api/customer/orders/route.ts');
const zones = source('src/lib/zones.ts');
const serviceability = source('src/app/api/customer/serviceability/route.ts');
const wizard = source('src/components/booking/BookingWizard.tsx');
const settings = source('src/hooks/useSettings.ts');
const adminSettings = source('src/app/admin/settings/page.tsx');
const commissionMigration = source('supabase/migrations/20261103032500_server_authoritative_water_commission.sql');

test('maintenance rejects only new customer checkouts before any reward reservation or insert', () => {
  const newCheckout = orders.split('export async function POST(req: NextRequest)')[1];
  const idempotent = newCheckout.indexOf('const existing = await findExistingCheckout();');
  const guard = newCheckout.indexOf("flat.maintenance_mode");
  const addressRead = newCheckout.indexOf(".from('addresses')");
  assert.ok(idempotent !== -1 && guard > idempotent && addressRead > guard);
  assert.match(newCheckout, /BOOKING_MAINTENANCE/);
  assert.match(orders, /export async function GET\(req: NextRequest\)/);
  assert.doesNotMatch(orders.split('export async function GET(req: NextRequest)')[1].split('export async function POST')[0], /BOOKING_MAINTENANCE/);
});

test('customer UI explains maintenance and retains an unsubmitted draft', () => {
  assert.match(settings, /maintenance_mode: raw\.maintenance_mode === true/);
  assert.match(wizard, /settings\.maintenance_mode && view < 4/);
  assert.match(wizard, /if \(settings\.maintenance_mode\)/);
  assert.match(wizard, /errCode === 'BOOKING_MAINTENANCE'/);
  assert.match(wizard, /Your booking draft is saved/);
});

test('the customer address is separate from the postal-office zone label', () => {
  assert.match(orders, /address: addressText \|\| null/);
  assert.match(orders, /address_id: addr\.id/);
  assert.match(wizard, /Delivery to: \{formatAddressCard/);
  assert.match(zones, /available at your selected delivery address/);
  assert.match(zones, /nearestRadiusZone\(\) \?\? pinZone/);
  assert.match(zones, /!pinZone \|\| isBookableZoneStatus\(pinZone\.status\)/);
  assert.match(serviceability, /prefer_precise_coordinates: isValidCoord\(row\.lat, row\.lng\)/);
});

test('the published version, not stale legacy platform_fee, sets new customer charges', () => {
  assert.match(orders, /const handlingFee = Number\(activePricingConfig\?\.convenience_fee\)/);
  assert.match(orders, /const deliveryFee = Number\(activePricingConfig\?\.delivery_fee\)/);
  assert.match(orders, /platform_fee: convenience/);
  assert.match(adminSettings, /Legacy accounting setting; NOT added to current customer checkout/);
});

test('new water-can orders snapshot the configured partner rate independently of payouts', () => {
  assert.match(orders, /commissionKey = isWater/);
  assert.match(orders, /commission_rate_pct: commissionRatePct/);
  assert.match(settings, /raw\.supplier_commission_rate \?\? raw\.supplier_commission/);
});

test('the database re-derives commission and ignores client-provided rates', () => {
  assert.match(commissionMigration, /NEW\.commission_rate_pct := NULL/);
  assert.match(commissionMigration, /NEW\.commission_rate_pct := v_commission_pct/);
  assert.match(commissionMigration, /FROM public\.settings WHERE key = v_commission_key/);
  assert.match(commissionMigration, /NEW\.supplier_payout := 0/);
  assert.match(commissionMigration, /NEW\.payment_verified_at := NULL/);
});

test('commission migration is one complete stored procedure with no trailing SQL fragments', () => {
  assert.equal(commissionMigration.split('CREATE OR REPLACE FUNCTION public.guard_orders_client_insert()').length, 2);
  assert.equal(commissionMigration.split('$function$').length, 3);
  assert.ok(commissionMigration.trimEnd().endsWith('$function$;'));
  assert.match(commissionMigration, /v_commission_text ~ '\^\[0-9\]\+\(\[\.\]\[0-9\]\+\)\?\$'/);
});
