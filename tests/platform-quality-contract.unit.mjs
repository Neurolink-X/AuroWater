import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DOMAIN_CONTRACTS, PROTECTED_APIS, CRITICAL_LINKS,
  domainsForChangedPath, requiredTestEvidence,
  hasRoute, verifyPlatformContracts, enforceChangeImpact,
} from '../scripts/platform-quality-contract.mjs';

test('every critical role and operation has an owned purpose, real source and regression suite', () => {
  assert.deepEqual(Object.keys(DOMAIN_CONTRACTS).sort(),[
    'admin','auth','booking','dispatch','finance','notifications','pricing',
    'subscriptions','supplier','technician',
  ]);
  for(const [name,contract] of Object.entries(DOMAIN_CONTRACTS)) {
    assert.ok(contract.owner && contract.purpose,name+' is missing context or purpose');
    assert.ok(contract.source.length>0 && contract.tests.length>0,name+' lacks explicit dependent source and test');
    assert.ok(contract.testName instanceof RegExp && contract.sourceName instanceof RegExp);
  }
  assert.ok(PROTECTED_APIS.length>=12);
  assert.ok(CRITICAL_LINKS.length>=5);
  assert.deepEqual(verifyPlatformContracts(),[]);
});

test('integration change-map traces a booking order edit into customer + pricing related gates', () => {
  const ids=domainsForChangedPath('src/app/api/customer/orders/route.ts');
  assert.ok(ids.includes('booking'));
  assert.equal(domainsForChangedPath('src/app/api/admin/partner-applications/route.ts').includes('admin'),true);
  assert.equal(domainsForChangedPath('src/app/technician/dashboard/page.tsx').includes('technician'),true);
  assert.equal(domainsForChangedPath('src/app/api/notifications/push/route.ts').includes('notifications'),true);
  assert.equal(domainsForChangedPath('src/lib/dispatch.ts').includes('dispatch'),true);
});

test('a green general test cannot hide booking-specific regressions', () => {
  const evidence=enforceChangeImpact([
    'src/app/api/customer/orders/route.ts',
    'tests/notification-retention-integrity.unit.mjs',
  ]);
  assert.ok(evidence.problems.some(p=>p.includes('booking')));
  assert.equal(evidence.summary.domains.includes('booking'),true);
  const source='src/app/api/customer/orders/route.ts';
  const ownedTests=domainsForChangedPath(source).map(d=>'tests/'+d+'-integration.unit.mjs');
  const fixed=enforceChangeImpact([source,...ownedTests]);
  assert.deepEqual(fixed.problems,[]);
  assert.ok(fixed.summary.domains.includes('finance'));
  assert.ok(fixed.summary.domains.includes('notifications'));
  assert.ok(fixed.summary.domains.includes('dispatch'));
});

test('shared authentication modifications require affected role/access tests', () => {
  const missing=enforceChangeImpact(['src/lib/api-client.ts','tests/technician-service-approval-flow.unit.mjs']);
  assert.ok(missing.problems.some(x=>x.includes('auth')));
  const fixed=enforceChangeImpact(['src/lib/api-client.ts','tests/auth-expiry-and-role-isolation.unit.mjs']);
  assert.deepEqual(fixed.problems,[]);
});

test('supplier job changes must update supplier/dispatch-relevant regression tests', () => {
  const bad=enforceChangeImpact(['src/app/api/supplier/orders/route.ts','tests/admin-list.unit.mjs']);
  assert.ok(bad.problems.some(x=>x.includes('supplier')));
  const changed='src/app/api/supplier/orders/route.ts';
  const good=enforceChangeImpact([changed,...domainsForChangedPath(changed).map(d=>'tests/'+d+'-integration.unit.mjs')]);
  assert.deepEqual(good.problems,[]);
});

test('unknown runtime changes cannot silently escape quality ownership', () => {
  const bad=enforceChangeImpact(['src/lib/unclassified-risk.ts','tests/other.unit.mjs']);
  assert.ok(bad.problems.some(x=>x.includes('Unmapped runtime change')));
  assert.equal(bad.summary.unmapped.length,1);
  assert.equal(enforceChangeImpact(['docs/change.md','tests/new.unit.mjs']).problems.length,0);
});

test('database migrations invalidate every dependent domain until scenario tests are updated', () => {
  const result=enforceChangeImpact(['supabase/migrations/20990101000000_example.sql','tests/technician-service.unit.mjs']);
  assert.equal(result.summary.domains.length,10);
  assert.ok(result.summary.missing.includes('finance'));
  assert.ok(result.summary.missing.includes('booking'));
});

test('all supported dynamic and static critical links resolve, missing links fail', () => {
  const routes=new Set(['/','/notifications','/customer/track/[id]','/admin/verification','/technician/services/apply']);
  assert.equal(hasRoute('/notifications',routes),true);
  assert.equal(hasRoute('/customer/track/example?from=home',routes),true);
  assert.equal(hasRoute('/technician/services/apply',routes),true);
  assert.equal(hasRoute('/register/pro',routes),false);
  assert.equal(hasRoute('/customer/track',routes),false);
});

test('contract scanner rejects missing role-guarded API and missing UI route',()=>{
  const root=mkdtempSync(join(tmpdir(),'aurotap-platform-contract-'));
  try {
    mkdirSync(join(root,'src/app/api/customer/orders'),{recursive:true});
    writeFileSync(join(root,'src/app/api/customer/orders/route.ts'),`export function GET(){ return new Response('unprotected') }`);
    mkdirSync(join(root,'src/app'),{recursive:true});
    const failures=verifyPlatformContracts(root);
    assert.ok(failures.some(m=>m.includes('API missing session check')));
    assert.ok(failures.some(m=>m.includes('missing route') || m.includes('expected owned source/test missing')));
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('test suite guards policy itself against inverted acceptance decisions',()=>{
  const sources=[
    'src/app/api/customer/orders/route.ts',
    'src/app/api/technician/jobs/route.ts',
    'src/app/api/admin/users/route.ts',
  ];
  const dependent=[...new Set(sources.flatMap(domainsForChangedPath))];
  const evidence=dependent.map(d=>'tests/'+d+'-cross-role.unit.mjs');
  assert.deepEqual(requiredTestEvidence([...sources,...evidence]).missing,[]);
  const removed=evidence.filter(p=>!p.includes('/technician-'));
  assert.ok(requiredTestEvidence([...sources,...removed]).missing.includes('technician'));
});
