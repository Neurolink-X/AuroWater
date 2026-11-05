import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const required = /\['aadhaar_front', 'aadhaar_back', 'profile_photo'\]/;

test('initial technician onboarding, dashboard and admin use one three-document checklist', () => {
  const receipt = read('src/app/register/pro/success/page.tsx');
  const dashboardRoute = read('src/app/api/technicians/documents/route.ts');
  const pending = read('src/components/admin/PendingPartnerApplications.tsx');
  const migration = read('supabase/migrations/20261105160000_partner_kyc_policy_consistency.sql');
  assert.match(receipt, required);
  assert.match(dashboardRoute, required);
  assert.match(pending, required);
  assert.match(migration, /document_slot IN \('aadhaar_front','aadhaar_back','profile_photo'\)/);
});

test('trade evidence is reviewed by a human and not faked with a preset note', () => {
  const migration = read('supabase/migrations/20261105160000_partner_kyc_policy_consistency.sql');
  const admin = read('src/app/admin/technician-capabilities/page.tsx');
  assert.match(migration, /length\(trim\(coalesce\(p_note,''\)\)\) < 20/);
  assert.match(admin, /20\+ characters/);
  assert.doesNotMatch(admin, /:'Verified ID and specialist qualification'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION.*TO service_role/);
});
