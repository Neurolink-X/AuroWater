import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = p => readFileSync(new URL(p,import.meta.url),'utf8');

test('shop review endpoint is independent from document review and admin guarded', () => {
 const endpoint=read('../src/app/api/admin/supplier-profile-requests/route.ts');
 assert.match(endpoint, /profile\.role!=='admin'/);
 assert.match(endpoint, /review_supplier_shop_change/);
 assert.doesNotMatch(endpoint, /\.from\('user_files'\)/);
 assert.match(endpoint, /private, no-store/);
});
test('one atomic review changes shop, records before/after history and audited decision', () => {
 const sql=read('../supabase/migrations/20261102160000_supplier_shop_atomic_approval.sql');
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/supplier_shop_location_history/);
 assert.match(sql,/previous_snapshot/);
 assert.match(sql,/audit_logs/);
 assert.match(sql,/supplier_shop_one_pending_request_idx/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.review_supplier_shop_change/);
});
test('remote shop location is reviewed, never immediately applied by supplier settings', () => {
 const profile=read('../src/app/api/supplier/profile/route.ts');
 const settings=read('../src/app/api/supplier/settings/route.ts');
 const ui=read('../src/app/supplier/profile/page.tsx');
 assert.match(profile,/base_lat:latitude,base_lng:longitude/);
 assert.match(profile,/supplier_profile_change_requests/);
 assert.match(settings,/Shop GPS and city changes require admin approval/);
 assert.match(ui,/Find my shop on Google Maps/);
});
