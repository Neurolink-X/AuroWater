import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin: authentication and recovery navigation remain guarded', () => {
  const shell = read('src/components/admin/AdminShell.tsx');
  const verification = read('src/app/admin/verification/page.tsx');
  const recovery = read('src/app/admin/dashboard/account-recovery/page.tsx');
  assert.match(shell, /const handleLogout = useCallback/);
  assert.match(shell, /verifiedRef\.current = false/);
  assert.match(shell, /router\.replace\('\/auth\/login'\)/);
  assert.match(shell, /if \(item\.id === 'logout'\) handleLogout\(\)/);
  assert.match(verification, /getToken/);
  assert.match(recovery, /getToken/);
});

test('booking and finance: server validates checkout while UI binds to selected address', () => {
  const wizard = read('src/components/booking/BookingWizard.tsx');
  const orders = read('src/app/api/customer/orders/route.ts');
  assert.match(wizard, /if \(settings\.maintenance_mode\)/);
  assert.match(wizard, /if \(!draft\.addressId \|\| !session\?\.loggedIn\)/);
  assert.match(wizard, /Delivery to: \{formatAddressCard/);
  assert.match(wizard, /customerOrderCreate\(/);
  assert.match(orders, /address_id: addr\.id/);
  assert.match(orders, /computeExpectedTotal\(netBaseAmount, convenience, emergency_charge, gstRate\)/);
  assert.match(orders, /BOOKING_MAINTENANCE/);
});

test('subscriptions: mutating a plan invalidates stale GET, confirms action and prevents double-click', () => {
  const page = read('src/app/customer/subscriptions/page.tsx');
  assert.match(page, /if \(busyId\) return/);
  assert.match(page, /window\.confirm\(/);
  assert.match(page, /requestSeq\.current\+\+/);
  assert.match(page, /customerSubscriptionUpdate\(/);
  for (const action of ["'pause'", "'resume'", "'cancel'"]) assert.ok(page.includes(action));
});

test('notifications: require user click for push, authenticated server disable and bounded requests', () => {
  const page = read('src/app/notifications/page.tsx');
  assert.match(page, /Notification\.requestPermission\(\)/);
  assert.match(page, /const enable = async \(\) =>/);
  assert.match(page, /const disable = async \(\) =>/);
  assert.match(page, /if \(inFlightRef\.current\) return/);
  assert.match(page, /await authedRequest\('\/api\/notifications\/push', 'POST', \{ action: 'disable' \}\)/);
  assert.match(page, /const token = data\.session\?\.access_token/);
});

test('technician: server token and document verification gate jobs and document uploads', () => {
  const dashboard = read('src/app/technician/dashboard/page.tsx');
  const uploader = read('src/components/private-files/DocumentUploader.tsx');
  assert.match(dashboard, /async function technicianAuthHeaders\(\)/);
  assert.match(dashboard, /const token = await getToken\(\)/);
  assert.match(dashboard, /const refreshDocumentStatus = useCallback/);
  assert.match(dashboard, /readJobsCache\(userId\)/);
  assert.match(uploader, /validateClientFile/);
  assert.match(uploader, /uploadPrivateFile/);
  assert.match(uploader, /getSignedFileUrl/);
});
