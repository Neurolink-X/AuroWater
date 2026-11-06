import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { planNearbyRoute } from '../src/lib/routing/slot-safe-route.ts';
const d=(minutes)=>new Date(Date.parse('2026-11-03T03:00:00Z')+minutes*60_000).toISOString();
const stop=(id,lat,lng,start,end)=>({id,lat,lng,scheduledAt:d(start),slotEndAt:d(end),serviceMinutes:8});
test('groups nearby stops when deadlines allow without making distant detour',()=>{
 const a=stop('A',28.6000,77.3000,0,120);
 const b=stop('B',28.6010,77.3010,0,120);
 const distant=stop('D',28.7500,77.5000,0,120);
 const plan=planNearbyRoute([a,distant,b],new Date(d(0)),{lat:28.6000,lng:77.3000});
 assert.deepEqual(plan.stops.map(s=>s.id),['A','B','D']);
 assert.equal(plan.mode,'advisory');
});
test('earlier deadline supersedes geographically closer stop',()=>{
 const near=stop('near',28.6,77.3,0,120);
 const urgent=stop('urgent',28.7,77.4,0,15);
 const plan=planNearbyRoute([near,urgent],new Date(d(0)),{lat:28.6,lng:77.3});
 assert.equal(plan.stops[0].id,'urgent');
 assert.equal(plan.stops[0].lateRisk,true);
});
test('unverified coordinates and times never enter route',()=>{
 const plan=planNearbyRoute([stop('valid',28.6,77.3,0,90),{id:'unknown',lat:null,lng:null,scheduledAt:d(0)}],new Date(d(0)));
 assert.deepEqual(plan.stops.map(x=>x.id),['valid']);
 assert.deepEqual(plan.excluded,['unknown']);
});
test('rejects out-of-range and non-finite coordinates without changing valid stops',()=>{
 const invalid=[stop('bad-lat',91,77.3,0,90),stop('bad-lng',28.6,-181,0,90),stop('bad-number',NaN,77.3,0,90)];
 const plan=planNearbyRoute([stop('valid',28.6,77.3,0,90),...invalid],new Date(d(0)));
 assert.deepEqual(plan.stops.map(s=>s.id),['valid']);
 assert.deepEqual(plan.excluded,['bad-lat','bad-lng','bad-number']);
});
test('API is provider-isolated and never exposes unaccepted delivery coordinates',()=>{
 const api=readFileSync('src/app/api/partner/route-plan/route.ts','utf8');
 assert.match(api,/\.eq\(field,\s*id\)/);
 assert.match(api,/acceptedIds\.has\(order\.id\)/);
 assert.match(api,/order\.status === 'IN_PROGRESS'/);
 assert.match(api,/slotEndAt: null/);
 assert.match(api,/\.limit\(MAX_STOPS\s*\+\s*1\)/);
 assert.match(api,/const MAX_STOPS = 30/);
 assert.doesNotMatch(api,/order_supplier_offers/);
});
