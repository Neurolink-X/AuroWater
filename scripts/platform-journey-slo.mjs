#!/usr/bin/env node
/**
 * Privacy-safe, offline SLO estimator. Input is aggregate JSON, never raw
 * user records. A small sample cannot prove 99.99% reliability.
 * Usage: node scripts/platform-journey-slo.mjs <aggregates.json>
 * JSON: { "window": "2026-11", "journeys": {
 *   "booking": { "success": 29997, "failure": 3 }, ...
 * }}
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { DOMAIN_CONTRACTS } from './platform-quality-contract.mjs';

export const TARGET=0.9999;
export const MAX_FAILURE=1-TARGET;
export const REQUIRED_N=30_000;
const Z=1.6448536269514722; // one-sided 95% normal quantile

export function evaluateJourney({ success, failure }) {
  if(!Number.isSafeInteger(success) || !Number.isSafeInteger(failure) ||
    success<0 || failure<0)throw new Error('Counts must be nonnegative safe integers');
  const n=success+failure;
  if(!Number.isSafeInteger(n) || n===0)return {
    samples:n, observed_success_rate:null, upper_failure_95:null,
    target:TARGET, status:'INSUFFICIENT_EVIDENCE',
  };
  const p=failure/n, a=Z*Z;
  // One-sided Wilson upper bound for the failure probability. For zero
  // failures use the exact binomial bound instead of approximating zero.
  const upper=failure===0
    ? 1-Math.pow(0.05,1/n)
    : (p+a/(2*n)+Z*Math.sqrt((p*(1-p)+a/(4*n))/n))/(1+a/n);
  return {
    samples:n, observed_success_rate:success/n,
    upper_failure_95:upper, target:TARGET,
    status:n<REQUIRED_N ? 'INSUFFICIENT_EVIDENCE'
      : upper<=MAX_FAILURE ? 'TARGET_SUPPORTED' : 'TARGET_NOT_DEMONSTRATED',
  };
}

export function evaluateReport(report) {
  if(!report || typeof report!=='object' || typeof report.window!=='string' ||
    !report.journeys || typeof report.journeys!=='object' || Array.isArray(report.journeys))
    throw new Error('Expected a window and aggregate journey counts');
  const required=Object.keys(DOMAIN_CONTRACTS);
  const evaluated=Object.fromEntries(required.map(name=>{
    const counts=report.journeys[name];
    return [name, counts ? evaluateJourney(counts) : {
      samples:0,observed_success_rate:null,upper_failure_95:null,
      target:TARGET,status:'MISSING_TELEMETRY',
    }];
  }));
  return { window:report.window, target:TARGET, journeys:evaluated,
    all_supported:Object.values(evaluated).every(x=>x.status==='TARGET_SUPPORTED') };
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==3) {
    console.error('Usage: node scripts/platform-journey-slo.mjs <aggregate-counts.json>');
    process.exit(2);
  }
  try {
    const data=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
    const result=evaluateReport(data);
    console.log(JSON.stringify(result,null,2));
    // Missing or failing telemetry is an explicit NOT PROVEN result.
    if(!result.all_supported)process.exitCode=1;
  } catch(e) {
    console.error('Cannot evaluate platform SLO:',e instanceof Error?e.message:'invalid input');
    process.exitCode=2;
  }
}
