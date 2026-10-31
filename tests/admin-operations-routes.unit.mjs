import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

test('admin zone UI and mutation endpoints live in App Router', () => {
  for (const path of [
    'src/app/admin/zones/page.tsx',
    'src/app/api/admin/zones/route.ts',
    'src/app/api/admin/zones/[id]/route.ts',
    'src/app/api/admin/zones/[id]/suppliers/route.ts',
    'src/app/api/admin/zones/metrics/route.ts',
    'src/app/admin/city-readiness/page.tsx',
    'src/app/api/admin/city-readiness/route.ts',
  ]) assert.ok(existsSync(join(root, path)), `Missing Next.js route: ${path}`);
});

test('zone operation routes register the intended authenticated handlers', () => {
  assert.match(read('src/app/api/admin/zones/[id]/route.ts'), /export \{ PUT \} from '@\/admin\/zones\/route'/);
  assert.match(read('src/app/api/admin/zones/[id]/suppliers/route.ts'), /export \{ GET, PUT \} from '@\/admin\/zones\/\[id\]\/route'/);
  assert.match(read('src/app/api/admin/zones/metrics/route.ts'), /export \{ GET \} from '@\/admin\/zones\/\[id\]\/suppliers\/route'/);
});

test('admin health report handles the real API envelope', () => {
  const api = read('src/lib/api/json-response.ts');
  assert.match(api, /NextResponse\.json\(\{ data, message: 'Success' \}/);
  const health = read('src/app/admin/order-health/page.tsx');
  assert.doesNotMatch(health, /envelope\.success/);
  assert.match(health, /Array\.isArray\(envelope\.data\.orders\)/);
  const city = read('src/app/admin/city-readiness/page.tsx');
  assert.doesNotMatch(city, /body\?\.success/);
  assert.match(city, /Array\.isArray\(body\.data\.cities\)/);
});

test('city readiness remains admin-only and never approves citywide launch', () => {
  const api = read('src/app/api/admin/city-readiness/route.ts');
  assert.match(api, /requireSupabaseAuth\(req\)/);
  assert.match(api, /requireAdmin\(auth\.ctx\)/);
  assert.match(api, /supplier_zones/);
  assert.match(api, /\.from\('cities'\)/);
  assert.match(api, /\.from\('service_zones'\)/);
  assert.match(api, /stockedIds/);
  assert.match(api, /not permission to launch a city/);
  assert.match(api, /service-specific eligibility and dispatch capacity/);
  const shell = read('src/components/admin/AdminShell.tsx');
  assert.match(shell, /href: '\/admin\/zones'/);
  assert.match(shell, /href: '\/admin\/city-readiness'/);
  assert.doesNotMatch(shell, /label: 'Noida Pilot'/);
});
