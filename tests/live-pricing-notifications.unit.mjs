import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('booking displays the combined published emergency and surge fees', () => {
  const booking = read('src/components/booking/BookingWizard.tsx');
  const settings = read('src/hooks/useSettings.ts');
  assert.match(booking, /settings\.emergency_surcharge \+ settings\.surge_charge/);
  assert.match(settings, /roundMoney\(settings\.emergency_surcharge \+ settings\.surge_charge\)/);
  assert.doesNotMatch(booking.slice(0, booking.indexOf('//  * Upgrades') > 0 ? booking.indexOf('//  * Upgrades') : undefined), /Pricing version \{settings\.pricing_version/);
});

test('booking hides unverified totals and preserves the server-confirmed order amount', () => {
  const booking = read('src/components/booking/BookingWizard.tsx');
  assert.match(booking, /pricingReady \? inr\(breakdown\.total\) : 'Checking current price/);
  assert.match(booking, /pricingReady \? inr\(breakdown\.total\) : 'Checking price/);
  assert.match(booking, /!pricingReady \|\| pricingLoading/);
  assert.match(booking, /Number\(createdOrder\.total_amount\)/);
  assert.match(booking, /\{confirmedTotal\}/);
});

test('a published price invalidates verified display and in-flight reads', () => {
  const hook = read('src/hooks/useSettings.ts');
  assert.match(hook, /setVerifiedCity\(null\)/);
  assert.match(hook, /settingsInFlight\.delete\(city\?\.trim\(\)\.toLowerCase\(\) \|\| ''\)/);
  assert.match(hook, /aw_pricing_published_at/);
  assert.match(hook, /latestVersionRef\.current/);
});

test('public pricing surfaces do not hardcode that delivery is always free', () => {
  const services = read('src/app/(public)/services/ServicesClient.tsx');
  const publicPrice = read('src/app/(public)/pricing/PricingClient.tsx');
  const home = read('src/app/(public)/HomeClient.tsx');
  assert.doesNotMatch(services, /Delivery included · No separate water delivery fee/);
  assert.match(publicPrice, /computeExpectedTotal\(quantity \* unit, settings\.convenience_fee \+ settings\.delivery_fee, 0, settings\.gst_rate\)/);
  assert.match(publicPrice, /orderFees=\{settings\.convenience_fee \+ settings\.delivery_fee\}/);
  assert.match(home, /currentEmergencyFee \+ currentSurgeFee/);
  assert.match(home, /pricingReady \? pricingFaqs\(settings\) : \[\]/);
});

test('notifications are discoverable and suppliers do not lose unread alerts on open', () => {
  const header = read('src/components/layout/Header.tsx');
  const dashboard = read('src/app/supplier/dashboard/page.tsx');
  const notifications = read('src/app/notifications/page.tsx');
  // Notification inbox lives in the desktop account menu and mobile drawer.
  // The crowded top bar intentionally has no standalone notification bell.
  assert.match(header, /href="\\/notifications"/);
  assert.doesNotMatch(header, /<NotificationBell/);
  assert.match(dashboard, /onClick=\{\(\) => setShowNotifs\(\(v\) => !v\)\}/);
  assert.match(dashboard, /Mark all read/);
  assert.match(dashboard, /In-app order notifications are always on/);
  // OS push permission must remain a user gesture; no forced consent on dashboard load.
  assert.match(notifications, /Notification\.requestPermission\(\)/);
});
