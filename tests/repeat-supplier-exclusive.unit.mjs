import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRepeatSupplierId,prioritizeRepeatSupplier,chooseOfferWave} from '../src/lib/supplier-affinity.ts';
const eligible=id=>({id,coverageTier:0,group:0,distance:1,load:0,favourite:false,tier:0});
test('previous completed supplier receives first exclusive offer',()=>{
 const rows=[eligible('near'),eligible('last'),eligible('third')];
 const repeat=selectRepeatSupplierId(rows,null,'last');
 assert.equal(repeat,'last');
 const ranked=prioritizeRepeatSupplier(rows,repeat);
 assert.deepEqual(chooseOfferWave(ranked,repeat,new Set()).map(c=>c.id),['last']);
 assert.deepEqual(chooseOfferWave(ranked,repeat,new Set(['last'])).map(c=>c.id),['near','third']);
});
test('customer-confirmed choice supersedes last supplier',()=>{
 const rows=[eligible('old'),eligible('chosen')];
 assert.equal(selectRepeatSupplierId(rows,'chosen','old'),'chosen');
});
test('ineligible supplier cannot receive exclusive offer',()=>{
 const rows=[eligible('current')];
 assert.equal(selectRepeatSupplierId(rows,null,'different'),null);
 assert.deepEqual(chooseOfferWave(rows,'different',new Set()).map(c=>c.id),['current']);
});
test('never reoffer previous supplier in the same order',()=>{
 const rows=[eligible('last'),eligible('other')];
 assert.deepEqual(chooseOfferWave(rows,'last',new Set(['last'])).map(x=>x.id),['other']);
 assert.deepEqual(chooseOfferWave(rows,'last',new Set(['last','other'])),[]);
});
