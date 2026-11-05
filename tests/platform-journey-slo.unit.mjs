import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN_CONTRACTS } from '../scripts/platform-quality-contract.mjs';
import { evaluateJourney,evaluateReport,TARGET } from '../scripts/platform-journey-slo.mjs';

test('99.99% is a measured target, never proven by a few green checks',()=>{
  assert.equal(TARGET,0.9999);
  assert.equal(evaluateJourney({success:100,failure:0}).status,'INSUFFICIENT_EVIDENCE');
  assert.equal(evaluateJourney({success:29999,failure:0}).status,'INSUFFICIENT_EVIDENCE');
  assert.equal(evaluateJourney({success:30000,failure:0}).status,'TARGET_SUPPORTED');
});

test('99.99% observed successes are not enough to claim confidence',()=>{
  const tested=evaluateJourney({success:29999,failure:1});
  assert.equal(tested.status,'TARGET_NOT_DEMONSTRATED');
  assert.ok(tested.upper_failure_95>0.0001);
});

test('zero samples and invalid/negative counts cannot be mistaken for success',()=>{
  assert.equal(evaluateJourney({success:0,failure:0}).status,'INSUFFICIENT_EVIDENCE');
  for(const counts of [{success:-1,failure:0},{success:0,failure:1.5},{success:NaN,failure:0}]) {
    assert.throws(()=>evaluateJourney(counts));
  }
});

test('all 10 critical journeys require telemetry, not just one fast happy path',()=>{
  const cases=Object.fromEntries(Object.keys(DOMAIN_CONTRACTS).map(name=>[name,{success:30000,failure:0}]));
  const full=evaluateReport({window:'2026-11',journeys:cases});
  assert.equal(full.all_supported,true);
  assert.equal(Object.keys(full.journeys).length,10);
  delete cases.finance;
  const missing=evaluateReport({window:'2026-11',journeys:cases});
  assert.equal(missing.all_supported,false);
  assert.equal(missing.journeys.finance.status,'MISSING_TELEMETRY');
});
