import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
test('every specialist registration validates and submits locality, PIN and radius',()=>{
 const form=read('src/app/register/pro/page.tsx');
 const api=read('src/app/api/applications/route.ts');
 for(const key of ['working_area','working_pincode','requested_radius_km']){
  assert.match(form,new RegExp(key));assert.match(api,new RegExp(key));
 }
 assert.match(form,/role === 'plumber'|recommendedRadiusKm/);
 assert.match(api,/registrationRoleMatchesSkills/);
});
test('admin review shows actual requested operating area; no auto approval',()=>{
 const page=read('src/app/admin/technician-capabilities/page.tsx');
 const api=read('src/app/api/admin/partner-applications/route.ts');
 assert.match(page,/working_pincode/);assert.match(page,/requested_radius_km/);
 assert.match(api,/review_partner_technician_application/);
 assert.match(read('src/app/api/applications/route.ts'),/status: 'pending'/);
});
