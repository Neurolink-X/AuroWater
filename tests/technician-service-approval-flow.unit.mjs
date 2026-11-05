import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TECHNICIAN_SERVICE_OPTIONS,
  REQUIRED_TECHNICIAN_IDENTITY_SLOTS,
  assessTechnicianServiceRequest,
  buildTechnicianServicePayload,
  isTechnicianServiceKey,
  requiredDocumentStates,
} from '../src/lib/technician-service-approval.ts';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const account = {
  role: 'technician', status: 'active', is_active: true,
  city: 'Kanpur', full_name: 'Test Technician', phone: '9000000000',
};
const docs = Object.fromEntries(REQUIRED_TECHNICIAN_IDENTITY_SLOTS.map(k => [k, 'approved']));
const scenario = (extra = {}) => ({
  account, serviceKey: 'plumbing', approvedServices: [], documentStatuses: docs,
  pending: null, ...extra,
});

test('scenario A: signed-in KYC-approved plumber requests plumbing without duplicate signup', () => {
  const decision = assessTechnicianServiceRequest(scenario());
  assert.deepEqual(decision,{ ok:true, reused:false });
  const body = buildTechnicianServicePayload({
    serviceKey:'plumbing', account, workingArea:'Kakadeo',
    workingPincode:'208025', experienceYears:3, workDescription:'Pipe fitting and repairs',
  });
  assert.equal(body.role,'plumber');
  assert.deepEqual(body.skills,['Plumbing']);
  assert.equal(body.city,'Kanpur');
  assert.equal(body.application_source,'existing_technician_service_approval');
  assert.equal(body.requested_radius_km,15);
});

test('scenario B: all four technician services have a deterministic approved role, skill and radius mapping', () => {
  assert.deepEqual(Object.keys(TECHNICIAN_SERVICE_OPTIONS).sort(),
    ['borewell','plumbing','ro_service','tank_cleaning'].sort());
  for (const key of Object.keys(TECHNICIAN_SERVICE_OPTIONS)) {
    assert.ok(isTechnicianServiceKey(key));
    const payload=buildTechnicianServicePayload({
      serviceKey:key, account, workingArea:'Kakadeo', workingPincode:'208025',
      experienceYears:2, workDescription:'Experience and reference evidence.',
    });
    assert.equal(payload.role,TECHNICIAN_SERVICE_OPTIONS[key].role);
    assert.deepEqual(payload.skills,[TECHNICIAN_SERVICE_OPTIONS[key].skill]);
    assert.equal(payload.requested_radius_km,TECHNICIAN_SERVICE_OPTIONS[key].radiusKm);
  }
  assert.equal(isTechnicianServiceKey('water_can'),false);
});

test('scenario C: different operational role, inactive profile and missing name/city block application', () => {
  const variants=[
    { account:{...account,role:'supplier'}, code:'NOT_TECHNICIAN', status:403 },
    { account:{...account,role:'customer'}, code:'NOT_TECHNICIAN', status:403 },
    { account:{...account,role:'admin'}, code:'NOT_TECHNICIAN', status:403 },
    { account:{...account,status:'suspended'}, code:'ACCOUNT_RESTRICTED', status:403 },
    { account:{...account,is_active:false}, code:'ACCOUNT_RESTRICTED', status:403 },
    { account:{...account,city:null}, code:'PROFILE_INCOMPLETE', status:422 },
    { account:{...account,full_name:''}, code:'PROFILE_INCOMPLETE', status:422 },
  ];
  for(const row of variants) {
    const result=assessTechnicianServiceRequest(scenario({account:row.account}));
    assert.equal(result.ok,false);
    assert.equal(result.code,row.code);
    assert.equal(result.status,row.status);
  }
});

test('scenario D: latest replacement/rejected documents override earlier approvals', () => {
  const statuses=requiredDocumentStates([
    {document_slot:'aadhaar_front',review_status:'rejected'},
    {document_slot:'aadhaar_front',review_status:'approved'}, // older
    {document_slot:'aadhaar_back',review_status:'approved'},
    {document_slot:'profile_photo',review_status:'approved'},
  ]);
  assert.equal(statuses.aadhaar_front,'rejected');
  const result=assessTechnicianServiceRequest(scenario({documentStatuses:statuses}));
  assert.equal(result.ok,false);
  assert.equal(result.code,'DOCUMENTS_INCOMPLETE');
  assert.equal(assessTechnicianServiceRequest(scenario({documentStatuses:{...docs,profile_photo:'pending'}})).code,'DOCUMENTS_INCOMPLETE');
});

test('scenario E: no duplicate approval and one pending request reused idempotently', () => {
  assert.equal(assessTechnicianServiceRequest(scenario({approvedServices:['plumbing']})).code,'ALREADY_APPROVED');
  const current={id:'fixture-123',status:'pending',payload:{role:'plumber'}};
  assert.deepEqual(assessTechnicianServiceRequest(scenario({pending:current})),{
    ok:true,reused:true,applicationId:'fixture-123',
  });
  assert.equal(
    assessTechnicianServiceRequest(scenario({pending:{...current,payload:{role:'ro'}}})).code,
    'OTHER_REQUEST_PENDING'
  );
});

test('scenario F: every service request traverses the correct authenticated API and real admin review', () => {
  const panel=read('src/components/technician/SpecialistStatusPanel.tsx');
  const signup=read('src/app/register/pro/page.tsx');
  const page=read('src/app/technician/services/apply/page.tsx');
  const api=read('src/app/api/technician/service-applications/route.ts');
  const admin=read('src/app/api/admin/partner-applications/route.ts');
  assert.match(panel,/href="\/technician\/services\/apply"/);
  assert.doesNotMatch(panel,/href="\/register\/pro" className="inline-flex min-h-10/);
  assert.match(signup,/existingTechnician/);
  assert.match(signup,/href="\/technician\/services\/apply"/);
  assert.match(page,/authorized<Status>\('GET'\)/);
  assert.match(page,/authorized<\{application_id:string;status:string;already_submitted:boolean\}>\('POST'/);
  assert.match(page,/Application under review/);
  assert.match(page,/Send for admin approval/);
  assert.match(api,/requireSupabaseAuth\(req\)/);
  assert.match(api,/requireRole\(auth.ctx,'technician'\)/);
  assert.match(api,/\.rpc\('submit_technician_service_request'/);
  assert.match(api,/assessTechnicianServiceRequest/);
  assert.match(admin,/review_partner_technician_application/);
});

test('scenario G: atomic SQL migration, full review and latest document security remain coupled', () => {
  const migration=read('supabase/migrations/20261105183000_technician_service_request_flow.sql');
  assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS technician_one_pending_application_idx/);
  assert.match(migration,/WHERE type='technician' AND status IN \('pending','pending_approval'\)/);
  assert.match(migration,/SELECT \* INTO account FROM public\.profiles WHERE id=p_user_id FOR UPDATE/);
  assert.match(migration,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
  assert.match(migration,/RETURN jsonb_build_object\('application_id',pending.id/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.submit_technician_service_request/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.submit_technician_service_request[\s\S]*TO service_role/);
  assert.match(migration,/UPDATE public\.profiles SET role='technician', verification_status='approved'/);
  assert.match(migration,/ON CONFLICT \(technician_id,service_key\) DO UPDATE/);
  assert.match(migration,/SELECT DISTINCT ON \(document_slot\)/);
  assert.match(migration,/ORDER BY document_slot,created_at DESC,id DESC/);
  assert.match(migration,/INSERT INTO public\.audit_logs/);
  assert.match(migration,/COMMIT;/);
});

test('scenario H: CI tests execute real policy behavior, not just source-file regex matches', () => {
  const packageJson=JSON.parse(read('package.json'));
  assert.match(packageJson.scripts['test:unit'], /tests\/\*\.unit\.mjs/);
  assert.equal(Object.keys(TECHNICIAN_SERVICE_OPTIONS).length,4);
  const rejected=assessTechnicianServiceRequest(scenario({approvedServices:['plumbing']}));
  assert.equal(rejected.ok,false);
});
