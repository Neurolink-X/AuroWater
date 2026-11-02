import test from 'node:test';
import assert from 'node:assert/strict';
import { rankSupplierCandidates, preferredSupplierId } from '../src/lib/supplier-affinity.ts';
const make = (id, distance, coverageTier=0) => ({id,distance,coverageTier,group:0,favourite:false,tier:0,load:0});
test('verified, unexpired customer relationship is eligible', () => {
 const now = new Date('2026-11-02T00:00:00Z');
 assert.equal(preferredSupplierId([{supplier_id:'a',status:'active',priority_expires_at:'2027-01-01T00:00:00Z',customer_confirmed_at:'2026-10-01T00:00:00Z'}],now),'a');
});
test('unconfirmed or expired relationships do not override dispatch', () => {
 const now = new Date('2026-11-02T00:00:00Z');
 assert.equal(preferredSupplierId([{supplier_id:'a',status:'active',priority_expires_at:'2027-01-01T00:00:00Z',customer_confirmed_at:null}],now),null);
 assert.equal(preferredSupplierId([{supplier_id:'a',status:'active',priority_expires_at:'2026-01-01T00:00:00Z',customer_confirmed_at:'2025-01-01T00:00:00Z'}],now),null);
});
test('preferred supplier wins over nearer peer within same coverage tier', () => {
 assert.equal(rankSupplierCandidates([make('near',1),make('referred',3)],'referred')[0].id,'referred');
});
test('coverage tier safety outranks supplier affinity', () => {
 assert.equal(rankSupplierCandidates([make('near',1,0),make('referred',3,1)],'referred')[0].id,'near');
});
test('missing preferred supplier falls back to normal ranking', () => {
 assert.equal(rankSupplierCandidates([make('far',4),make('near',1)],'missing')[0].id,'near');
});
test('ranking does not mutate original list', () => {
 const list=[make('far',4),make('near',1)];
 rankSupplierCandidates(list,'near');
 assert.equal(list[0].id,'far');
});
