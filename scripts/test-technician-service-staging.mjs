#!/usr/bin/env node
/**
 * Authenticated role-and-data E2E. Intentionally writes ONLY to a non-production,
 * isolated staging fixture. Never run against live AuroTap or production DB.
 *
 * Required: TECHNICIAN_STAGE_URL, TECHNICIAN_STAGE_TOKEN, ADMIN_STAGE_TOKEN.
 * The technician fixture must be active, with 3 approved ID photos and no
 * pending technician applications or approved "plumbing" capability.
 */
import assert from 'node:assert/strict';

const base = process.env.TECHNICIAN_STAGE_URL;
const token = process.env.TECHNICIAN_STAGE_TOKEN;
const admin = process.env.ADMIN_STAGE_TOKEN;
if (!base || !token || !admin) {
  throw new Error('BLOCKED: Stage URL, technician and admin tokens are mandatory. No test was run.');
}
const url = new URL(base);
const host = url.hostname.toLowerCase();
if (url.protocol !== 'https:' ||
  host === 'aurotap.in' || host === 'www.aurotap.in' ||
  host === 'auro-water.vercel.app' ||
  host === 'auro-water-neurolinkxs-projects.vercel.app' ||
  host.includes('git-main-') ||
  !(host.endsWith('.vercel.app') || host.startsWith('staging.'))) {
  throw new Error('BLOCKED: Refusing to mutate a production or unrecognized deployment.');
}
const bypass=process.env.VERCEL_AUTOMATION_BYPASS;
async function request(path, credentials, method='GET', body) {
  const res=await fetch(new URL(path,url),{
    method,cache:'no-store',
    headers:{Authorization:`Bearer ${credentials}`,
      ...(bypass?{'x-vercel-protection-bypass':bypass}:{}),
      ...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
  });
  const data=await res.json().catch(()=>({}));
  return {status:res.status,data};
}
const assertStatus=(result,expected,context)=>{
  assert.equal(result.status,expected,`${context}: ${JSON.stringify(result.data).slice(0,250)}`);
};
const state=await request('/api/technician/service-applications',token);
assertStatus(state,200,'technician eligibility GET');
assert.equal(state.data.data?.documents_approved,true,'fixture KYC must already be approved');
assert.equal(state.data.data?.account_active,true,'fixture account must be active');
assert.equal(state.data.data?.pending_application,null,'fixture must have no pending application');
assert.ok(!state.data.data?.approved_services.includes('plumbing'),'fixture plumbing must be unapproved');
console.log('PASS 1: role-aware GET, KYC and active technician fixture');

const invalid=await request('/api/technician/service-applications',token,'POST',{
  serviceKey:'water_can',workingArea:'Kakadeo',workingPincode:'208025',
  experienceYears:3,workDescription:'Fifteen years of verified plumbing experience.',
});
assertStatus(invalid,422,'supplier-role service injection');
console.log('PASS 2: server rejects wrong service role before database write');

const payload={
  serviceKey:'plumbing',workingArea:'Kakadeo',workingPincode:'208025',
  experienceYears:3,workDescription:'Stage test fixture: demonstrated plumbing repair and tap installation reference.',
};
const [first,second]=await Promise.all([
  request('/api/technician/service-applications',token,'POST',payload),
  request('/api/technician/service-applications',token,'POST',payload),
]);
for(const [index,value] of [[0,first],[1,second]]) {
  assert.ok([200,201].includes(value.status),`concurrent submission ${index} failed: ${JSON.stringify(value.data)}`);
}
const id=first.data.data?.application_id;
assert.match(id,/^[0-9a-f-]{36}$/i);
assert.equal(second.data.data?.application_id,id,'concurrent submission created duplicate applications');
console.log('PASS 3: duplicate concurrent requests return ONE application reference');

const shown=await request('/api/technician/service-applications',token);
assertStatus(shown,200,'pending receipt');
assert.equal(shown.data.data?.pending_application?.id,id);
console.log('PASS 4: applicant sees server-confirmed pending receipt');

const other=await request('/api/technician/service-applications',token,'POST',{
  ...payload,serviceKey:'ro_service',
});
assertStatus(other,409,'another service blocked during pending review');
console.log('PASS 5: cannot submit a conflicting service while review is pending');

const adminQueue=await request('/api/admin/partner-applications',admin);
assertStatus(adminQueue,200,'admin pending queue');
const pending=adminQueue.data.data?.find(row=>row.id===id);
assert.ok(pending,'admin Pending approvals did not include the new request');
assert.equal(pending?.payload?.role,'plumber');
assert.deepEqual(pending?.payload?.skills,['Plumbing']);
console.log('PASS 6: same application appears in existing admin pending queue');

const decision=await request('/api/admin/partner-applications',admin,'PATCH',{
  application_id:id,decision:'approved',
  note:'Staging: matched identity front/back and profile photo; verified plumbing repairs and experience reference.',
});
assertStatus(decision,200,'admin atomic approval');
console.log('PASS 7: Admin approved the requested service with evidence');

const approved=await request('/api/technician/specializations',token);
assertStatus(approved,200,'service approval read-back');
assert.ok(approved.data.data?.approved.some(s=>s.service_key==='plumbing'),
  'Admin action did not activate plumbing capability');
assert.equal(approved.data.data?.profile?.verification,'approved');
console.log('PASS 8: same technician gained ONLY approved capability');

const repeat=await request('/api/technician/service-applications',token,'POST',payload);
assertStatus(repeat,409,'already approved capability');
console.log('PASS 9: cannot request an already approved service');

const secondService=await request('/api/technician/service-applications',token,'POST',{
  ...payload,serviceKey:'ro_service',
});
assertStatus(secondService,201,'second service request');
const secondId=secondService.data.data?.application_id;
const reject=await request('/api/admin/partner-applications',admin,'PATCH',{
  application_id:secondId,decision:'rejected',note:'Staging: RO qualification not verified',
});
assertStatus(reject,200,'admin rejection');
const afterReject=await request('/api/technician/specializations',token);
assertStatus(afterReject,200,'status after rejection');
assert.ok(!afterReject.data.data?.approved.some(s=>s.service_key==='ro_service'));
assert.equal(afterReject.data.data?.application?.status,'rejected');
console.log('PASS 10: rejected service never becomes approved');
console.log('STAGING SERVICE APPROVAL FLOW PASSED (role, KYC, concurrent submit, receipt, admin, approval, rejection).');
