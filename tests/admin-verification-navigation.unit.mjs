import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, verifyPlatformContracts, domainsForChangedPath, requiredTestEvidence } from '../scripts/platform-quality-contract.mjs';

test('admin Users pending approvals contains a real, role-protected verification destination', () => {
  const page=readFileSync(join(ROOT,'src/app/admin/users/page.tsx'),'utf8');
  const route=readFileSync(join(ROOT,'src/app/api/admin/verification/route.ts'),'utf8');
  assert.match(page, /href="\/admin\/verification"/);
  assert.ok(existsSync(join(ROOT,'src/app/admin/verification/page.tsx')));
  assert.match(route, /requireSupabaseAuth/);
  assert.match(route, /requireAdmin/);
  assert.deepEqual(verifyPlatformContracts().filter(x=>x.includes('admin/verification')), []);
});

test('admin navigation updates cannot be released with only unrelated tests',()=>{
  const file='src/app/admin/users/page.tsx';
  assert.ok(domainsForChangedPath(file).includes('admin'));
  assert.ok(requiredTestEvidence([file,'tests/notifications.unit.mjs']).missing.includes('admin'));
  assert.ok(!requiredTestEvidence([file,'tests/admin-verification-navigation.unit.mjs']).missing.includes('admin'));
});
