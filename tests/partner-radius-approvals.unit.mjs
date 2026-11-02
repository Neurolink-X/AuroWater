import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('specialist booking and dispatch share service-specific radius',()=>{
 const booking=read('src/lib/booking/local-specialist-readiness.ts');
 const dispatch=read('src/lib/dispatch.ts').split('// import { NextRequest')[0];
 const policy=read('src/lib/technician-service-radius.ts');
 assert.match(booking,/technicianRadius\(service,radiusByTechnician/);
 assert.match(dispatch,/technicianRadius\(serviceKey,radiusByTechnician/);
 assert.match(policy,/borewell:50,tank_cleaning:50/);
 assert.match(policy,/plumbing:15/);
});
test('radius expansions require protected admin review, never customer PIN bypass',()=>{
 const api=read('src/app/api/admin/radius-requests/route.ts');
 const supplier=read('src/app/api/supplier/radius-requests/route.ts');
 const specialist=read('src/app/api/technician/service-radii/route.ts');
 const migration=read('supabase/migrations/20261103100000_partner_radius_approval_and_specialist_limits.sql');
 assert.match(api,/requireAdmin/);
 assert.match(supplier,/requireRole\(auth.ctx,'supplier'\)/);
 assert.match(specialist,/requireRole\(auth.ctx,'technician'\)/);
 assert.match(migration,/review_partner_radius_request/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public.review_partner_radius_request/);
 assert.match(migration,/try_assign_technician/);
});
