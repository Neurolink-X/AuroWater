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

test('admin navigation starts at the top and Orders starts with current work', () => {
  const shell = readFileSync(join(ROOT, 'src/components/admin/AdminShell.tsx'), 'utf8');
  const orders = readFileSync(join(ROOT, 'src/app/admin/orders/page.tsx'), 'utf8');
  const route = readFileSync(join(ROOT, 'src/app/api/admin/orders/route.ts'), 'utf8');
  assert.match(shell, /scrollTargetRef\.current !== pathname/);
  assert.match(shell, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'instant' \}\)/);
  assert.match(orders, /\[status, setStatus\] = useState\('CURRENT'\)/);
  assert.match(orders, /\{ value: '', label: 'All' \}/);
  assert.match(route, /status === 'CURRENT'[\s\S]*?query\.not\('status', 'in', '\(COMPLETED,CANCELLED,FAILED\)'\)/);
});

test('an admin verification failure offers retry without signing the user out', () => {
  const shell = readFileSync(join(ROOT, 'src/components/admin/AdminShell.tsx'), 'utf8');
  const check = shell.slice(shell.indexOf('const verifySession ='), shell.indexOf('/*\n   * First check'));
  assert.match(check, /error\.code === 'SESSION_EXPIRED'/);
  assert.doesNotMatch(check, /logout\(/);
  assert.match(shell, /Retry verification/);
});
