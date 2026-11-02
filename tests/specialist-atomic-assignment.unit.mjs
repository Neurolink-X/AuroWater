import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('admin assignment and specialist review are atomic RPCs',()=>{
 const assign=read('../src/app/api/admin/technicians/[id]/assign/route.ts');
 const review=read('../src/app/api/admin/technician-capabilities/route.ts');
 const sql=read('../supabase/migrations/20261102183000_specialist_atomic_approvals_assignments.sql');
 assert.match(assign,/admin_assign_specialist/);
 assert.doesNotMatch(assign,/\.update\(\{\s*technician_id:/);
 assert.match(review,/review_technician_capability/);
 assert.match(sql,/orders_verified_technician_assignment/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/accepted_at IS NOT NULL/);
});
