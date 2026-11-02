import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const raw=readFileSync('src/lib/dispatch-coverage.ts','utf8');
const javascript=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function('exports','require',javascript)(exports,()=>{throw Error('Unexpected import')});
const match=exports.matchApprovedSupplierCoverage;
const zone=(overrides={})=>({
  id:'zone-same-pin',city:'Noida',status:'AVAILABLE',
  is_catch_all:false,pincodes:['201316'],services:['water_can'],...overrides
});
const allowed=(links,zones,pin='201316',city='noida',service='water_can')=>
  match('current-customer-zone',pin,city,service,links,new Map(zones.map(z=>[z.id,z])));

test('exactly approved zone wins over any fallback',()=>{
  assert.deepEqual(allowed([{zoneId:'current-customer-zone',serviceKeys:['water_can']}],[]),
    {allowed:true,tier:0,mode:'exact_zone'});
});
test('approved identical PIN in a different zone is eligible and ranked second',()=>{
  assert.deepEqual(allowed([{zoneId:'zone-same-pin',serviceKeys:['water_can']}],[zone()]),
    {allowed:true,tier:1,mode:'approved_pin'});
});
test('explicit citywide approval is fallback tier two, never an implicit PIN expansion',()=>{
  const catchAll=zone({id:'citywide',is_catch_all:true,pincodes:[]});
  assert.deepEqual(allowed([{zoneId:'citywide',serviceKeys:['water_can']}],[catchAll]),
    {allowed:true,tier:2,mode:'approved_citywide'});
  assert.equal(allowed([{zoneId:'pilot',serviceKeys:['water_can']}],[zone({id:'pilot',pincodes:[],is_catch_all:false})]).allowed,false);
});
test('rejects outside PIN, other city, inactive zone or unapproved service',()=>{
  const link=[{zoneId:'zone-same-pin',serviceKeys:['water_can']}];
  assert.equal(allowed(link,[zone()],'201317').allowed,false);
  assert.equal(allowed(link,[zone()],'201316','kanpur').allowed,false);
  assert.equal(allowed(link,[zone({status:'PAUSED'})]).allowed,false);
  assert.equal(allowed(link,[zone()],'201316','noida','plumbing').allowed,false);
  assert.equal(allowed([{zoneId:'zone-same-pin',serviceKeys:['plumbing']}],[zone()]).allowed,false);
});
test('invalid PINs and missing approval fail closed',()=>{
  assert.equal(allowed([],[]).allowed,false);
  assert.equal(allowed([{zoneId:'zone-same-pin',serviceKeys:null}],[zone()],'').allowed,false);
  assert.equal(allowed([{zoneId:'zone-same-pin',serviceKeys:null}],[zone()],'20131').allowed,false);
});
test('dispatch still enforces strict selected radius after coverage',()=>{
 const source=readFileSync('src/lib/dispatch.ts','utf8').split('export async function dispatchOrder(')[0];
 assert.match(source,/matchApprovedSupplierCoverage/);
 assert.match(source,/withinSupplierRadius\(distance, radius\)/);
 assert.doesNotMatch(source,/fallbackRadius\s*=/);
});
