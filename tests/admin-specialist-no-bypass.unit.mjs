import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('generic admin order PATCH cannot bypass atomic specialist assignment',()=>{
 const api=readFileSync(new URL('../src/app/api/admin/orders/[id]/route.ts',import.meta.url),'utf8');
 const allow=api.split('const ALLOWED_UPDATE_FIELDS = [')[1].split('] as const')[0];
 assert.doesNotMatch(allow,/'technician_id'/);
 const specialist=readFileSync(new URL('../src/app/api/admin/technicians/[id]/assign/route.ts',import.meta.url),'utf8');
 assert.match(specialist,/admin_assign_specialist/);
});
