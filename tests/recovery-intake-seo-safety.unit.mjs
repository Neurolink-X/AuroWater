import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('account recovery requires recorded customer-confirmed resolution', () => {
  const schema = src('src/lib/account-recovery/shared.ts');
  const route = src('src/app/api/admin/account-recovery/route.ts');
  assert.match(schema, /resolution_confirmed: z\.boolean\(\)/);
  assert.match(schema, /v\.status === 'resolved' && !v\.resolution_confirmed/);
  assert.match(route, /status === 'resolved' && \(!resolution_confirmed/);
  assert.match(route, /account_match: linked \? 'linked'/);
});

test('registered email reset is gated, throttled and has a server audit', () => {
  const reset = src('src/app/api/admin/account-recovery/reset/route.ts');
  assert.match(reset, /auth\.ctx\.profile\.role !== 'admin'/);
  assert.match(reset, /consume_account_recovery_rate_limit/);
  assert.match(reset, /resetPasswordForEmail\(registeredEmail/);
  assert.match(reset, /registered_email_reset_requested/);
  assert.doesNotMatch(reset, /resetPasswordForEmail\(target/);
});

test('only eligible borewell and tank cleaning requests may wait without a worker', () => {
  const orders = src('src/app/api/customer/orders/route.ts');
  assert.match(orders, /specialist\.unavailable &&[\s\S]*?service_type_key === 'borewell'/);
  assert.match(orders, /service_type_key === 'tank_cleaning'/);
  assert.match(orders, /!specialist\.ok && !manualIntake/);
  assert.match(orders, /status: 'PENDING'/);
  assert.match(orders, /manual local dispatch follow-up required/);
});

test('pending bookings do not claim confirmed technician assignment', () => {
  const ui = src('src/components/booking/BookingWizard.tsx');
  assert.match(ui, /Request received - awaiting assignment/);
  assert.match(ui, /NOT yet confirmed/);
  assert.match(ui, /professional and the requested time window/i);
});

test('account recovery is linked from real Users and Noida is in canonical sitemap', () => {
  assert.match(src('src/app/admin/users/page.tsx'), /href="\/admin\/dashboard\/account-recovery"/);
  assert.match(src('src/app/sitemap.ts'), /'\/water-delivery\/noida'/);
  assert.match(src('src/app/(public)/water-delivery/[city]/page.tsx'), /noida: \{/);
});

test('recovery closure requires actual three-stage evidence instead of an admin checkbox', () => {
  const route = src('src/app/api/admin/account-recovery/route.ts');
  assert.match(route, /if \(verify_ownership\)/);
  assert.match(route, /workflowState\(evidenceResult\.data \?\? \[\]\)\.ready/);
  assert.match(route, /p_verify_ownership: verify_ownership/); // rejected before RPC
  const admin = src('src/app/admin/dashboard/account-recovery/page.tsx');
  assert.match(admin, /<AccountRecoveryWorkflow/);
  assert.doesNotMatch(admin.split("\n// 'use client'")[0], /Confirm ownership verified<\/label>/);
});
test('customer confirmation is restricted to the original authenticated account', () => {
  const route = src('src/app/api/customer/account-recovery/confirm/route.ts');
  assert.match(route, /ticket\.user_id !== auth\.ctx\.user\.id/);
  assert.match(route, /ticket\.ownership_verified_at/);
  assert.match(route, /action: 'customer_recovery_confirmed'/);
  const page = src('src/app/customer/account-recovery/page.tsx');
  assert.match(page, /I can sign in and my issue is fixed/);
});
test('sensitive categories cannot be silently marked fixed', () => {
  const workflow = src('src/app/api/admin/account-recovery/workflow/route.ts');
  assert.match(workflow, /auth\.admin\.getUserById/);
  assert.match(workflow, /authEmail === baseline/);
  assert.match(workflow, /profile\.status !== 'active'/);
  assert.match(workflow, /second independent admin/);
});
