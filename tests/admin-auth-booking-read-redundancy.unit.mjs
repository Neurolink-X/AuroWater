import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReadCoordinator,readRequestKey} from '../src/lib/api/read-coordinator.ts';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('identical pending reads execute once, but a later reload still fetches fresh data',async()=>{
 const reads=createReadCoordinator();const d=deferred();let calls=0;
 const loader=async()=>{calls++;return d.promise;};
 const a=reads.run('same',loader);const b=reads.run('same',loader);
 await Promise.resolve();assert.equal(calls,1);d.resolve({value:1});assert.deepEqual(await a,await b);
 await reads.run('same',async()=>{calls++;return {value:2};});assert.equal(calls,2);
});
test('one cancelled consumer cannot abort another page/component sharing the read',async()=>{
 const reads=createReadCoordinator();const d=deferred();const a=new AbortController();const b=new AbortController();let shared;
 const loader=signal=>{shared=signal;return d.promise;};
 const first=reads.run('same',loader,a.signal);const rejected=assert.rejects(first,{name:'AbortError'});
 const second=reads.run('same',loader,b.signal);await Promise.resolve();a.abort();await rejected;
 assert.equal(shared.aborted,false);d.resolve('valid');assert.equal(await second,'valid');
});
test('last consumer cancellation aborts unused work and releases the key for a new request',async()=>{
 const reads=createReadCoordinator();const a=new AbortController();let signal;
 const first=reads.run('same',async s=>{signal=s;return new Promise((_r,reject)=>{s.addEventListener('abort',()=>reject(s.reason),{once:true});});},a.signal);
 const rejected=assert.rejects(first,{name:'AbortError'});await Promise.resolve();a.abort();await rejected;assert.equal(signal.aborted,true);
 assert.equal(await reads.run('same',async()=>42),42);
});
test('aborted-before-start and rejected reads do not poison later calls',async()=>{
 const reads=createReadCoordinator();const a=new AbortController();a.abort();let calls=0;
 await assert.rejects(reads.run('same',async()=>{calls++;},a.signal));assert.equal(calls,0);
 await assert.rejects(reads.run('same',async()=>{throw Error('temporary');}),/temporary/);
 assert.equal(await reads.run('same',async()=>9),9);
});
test('identity, request headers and filters isolate shared reads',()=>{
 const key=(token,filter='pending')=>readRequestKey(`/admin/users?status=${filter}`,{headers:{Authorization:token}});
 assert.notEqual(key('A'),key('B'));assert.notEqual(key('A'),key('A','all'));
 assert.notEqual(readRequestKey('/same',{headers:{'X-Scope':'one'}}),readRequestKey('/same',{headers:{'X-Scope':'two'}}));
 assert.equal(readRequestKey('/same',{headers:[['A','1'],['B','2']]}),readRequestKey('/same',{headers:[['B','2'],['A','1']]}));
});
test('write invalidation detaches old generations without cancelling existing readers',async()=>{
 const reads=createReadCoordinator();const old=deferred();let signal;
 const previous=reads.run('same',s=>{signal=s;return old.promise;});await Promise.resolve();reads.clear();
 assert.equal(await reads.run('same',async()=> 'after-write'),'after-write');assert.equal(signal.aborted,false);
 old.resolve('before-write');assert.equal(await previous,'before-write');
});
test('legacy approval links use the canonical workflow, and order details do not prefetch technicians',()=>{
 const legacy=readFileSync('src/app/admin/dashboard/users/page.tsx','utf8');
 const users=readFileSync('src/app/admin/users/page.tsx','utf8');
 const orders=readFileSync('src/app/admin/orders/page.tsx','utf8');
 assert.match(legacy,/redirect\(`/);assert.match(legacy,/\/admin\/users\?/);assert.doesNotMatch(legacy,/authMe|adminUsersWithMeta/);
 assert.match(users,/<PendingPartnerApplications/);
 const drawer=orders.slice(orders.indexOf('const openDrawer'),orders.indexOf('const closeDrawer'));
 assert.doesNotMatch(drawer,/adminTechniciansList/);
 assert.match(orders,/adminTechniciansList\(serviceKey\)/);
});
test('mutations bypass sharing and clear both read generations',()=>{
 const source=readFileSync('src/lib/api-client.ts','utf8');
 assert.match(source,/toUpperCase\(\) !== 'GET'/);
 assert.match(source,/finally \{ parsedReads\.clear\(\); rawReads\.clear\(\); \}/);
 assert.match(source,/init\.signal\?\?undefined/);
});

test('coverage refreshes do not overlap and obsolete user searches are cancelled',()=>{
 const coverage=readFileSync('src/app/admin/coverage-requests/page.tsx','utf8');
 const users=readFileSync('src/app/admin/users/page.tsx','utf8');
 assert.match(coverage,/if \(silent && requestRef.current\) return/);
 assert.match(coverage,/adminCoverageRequestsList<Row\[\]>\(request.signal\)/);
 assert.match(coverage,/requestRef.current\?\.abort\(\)/);
 assert.match(users,/adminUsersWithMeta\(params, request.signal\)/);
 assert.match(users,/userReadRef.current\?\.abort\(\)/);
});
