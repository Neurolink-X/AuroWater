import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = (path) => readFileSync(new URL(path,import.meta.url),'utf8');
test('only authenticated technician sees their own approved service capabilities',()=>{
 const api=read('../src/app/api/technician/specializations/route.ts');
 assert.match(api,/requireSupabaseAuth\(req\)/);
 assert.match(api,/requireRole\(auth.ctx, 'technician'\)/);
 assert.match(api,/\.eq\('technician_id', id\)/);
 assert.match(api,/\.eq\('user_id', id\)/);
 assert.match(api,/private, no-store/);
 assert.match(api,/\.filter\(x => x.status === 'approved'\)/);
});
test('one canonical professional dashboard displays server-confirmed specialist skills',()=>{
 const dash=read('../src/app/technician/dashboard/page.tsx');
 const panel=read('../src/components/technician/SpecialistStatusPanel.tsx');
 const redirect=read('../src/app/plumber/dashboard/page.tsx');
 assert.match(dash,/SpecialistStatusPanel/);
 assert.match(panel,/No service is approved yet/);
 assert.match(panel,/setRecord\(null\)/);
 assert.match(redirect,/redirect\('\/technician\/dashboard'\)/);
});

test('shared authenticated ProfileRow exposes optional server verification status', () => {
  const types = read('../src/lib/db/types.ts');
  // The file contains an archived commented-out interface; select the active contract.
  const start = types.lastIndexOf('export interface ProfileRow {');
  assert.ok(start >= 0, 'Active ProfileRow interface is missing');
  const end = types.indexOf('\n}', start);
  assert.ok(end > start, 'Active ProfileRow interface is incomplete');
  const row = types.slice(start, end);
  assert.match(row, /verification_status\?:\s*string\s*\|\s*null/);
  const endpoint = read('../src/app/api/technician/specializations/route.ts');
  assert.match(endpoint, /auth\.ctx\.profile\.verification_status/);
});
