import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('professional form cannot claim success before a verified persisted application ID', () => {
  const page = read('src/app/register/pro/page.tsx');
  const receipt = read('src/app/register/pro/success/page.tsx');
  const api = read('src/app/api/applications/me/route.ts');
  assert.match(page, /getToken\(/);
  assert.match(page, /Authorization: 'Bearer '/);
  assert.match(page, /!json\.data\?\.id/);
  assert.match(page, /Not submitted yet/);
  assert.match(receipt, /No saved application for this account/);
  assert.match(receipt, /\/api\/applications\/me/);
  assert.match(api, /\.eq\('user_id', auth\.ctx\.user\.id\)/);
  assert.match(api, /Cache-Control', 'private, no-store'/);
});

test('a customer account gets private KYC slots only with own real pending technician request', () => {
  const files = read('src/app/api/files/route.ts');
  const upload = read('src/app/api/files/upload/route.ts');
  for (const code of [files, upload]) {
    assert.match(code, /\.eq\('user_id', (auth\.ctx\.user\.id|userId)\)/);
    assert.match(code, /\.eq\('type', 'technician'\)/);
    assert.match(code, /\['pending', 'pending_approval'\]/);
  }
  assert.match(upload, /pendingTechnicianApplicant/);
  assert.match(upload, /applicantSlotAllowed/);
  assert.match(upload, /detectPrivateFileMime/);
});

test('admin can securely review docs from customer-profile applicants without non-existent profile columns', () => {
  const api = read('src/app/api/admin/verification/route.ts');
  const review = read('src/app/api/admin/partner-applications/route.ts');
  const security = read('supabase/migrations/20261105123000_partner_application_auth_write_hardening.sql');
  assert.doesNotMatch(api, /PROFILE_COLUMNS = '[^']*business_name/);
  assert.match(api, /pendingIds\.has\(profile\.id\)/);
  assert.match(api, /effectiveRole/);
  assert.match(review, /review_partner_technician_application/);
  assert.match(review, /Partner application needs attention/);
  assert.match(security, /DROP POLICY IF EXISTS app_own/);
  assert.match(security, /FOR SELECT TO authenticated/);
  assert.match(security, /applications_one_pending_per_role_idx/);
});

test('consolidated admin navigation retains notification inbox without header bell', () => {
  const header = read('src/components/layout/Header.tsx');
  const approvals = read('src/app/admin/dashboard/users/page.tsx');
  assert.doesNotMatch(header, /<NotificationBell/);
  assert.match(header, /href="\/notifications"/);
  assert.match(approvals, /<PendingPartnerApplications/);
  const queue = read('src/components/admin/PendingPartnerApplications.tsx');
  const endpoint = read('src/app/api/admin/partner-applications/route.ts');
  assert.match(queue, /review_supported/);
  assert.match(queue, /Review KYC documents/);
  assert.match(endpoint, /\.in\('type',\['technician','supplier'\]\)/);
  assert.match(approvals, /href="\/admin\/verification"/);
});
