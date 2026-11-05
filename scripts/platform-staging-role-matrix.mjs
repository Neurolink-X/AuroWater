#!/usr/bin/env node
/**
 * Safe, READ-ONLY, authenticated, cross-role HTTP tests using an isolated
 * staging deployment + independent Supabase project.
 *
 * This script performs GET only. It never creates accounts, orders, KYC files,
 * payouts, service approvals or user data. Secrets must be stage-only.
 */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const stageUrl=process.env.PLATFORM_STAGE_URL;
const supabaseUrl=process.env.PLATFORM_STAGE_SUPABASE_URL;
const supabaseKey=process.env.PLATFORM_STAGE_SUPABASE_ANON_KEY;
const confirmed=process.env.PLATFORM_STAGE_DB_ISOLATED;
if(confirmed!=='yes' || !stageUrl || !supabaseUrl || !supabaseKey)
  throw new Error('BLOCKED: isolated staging URL, separate Supabase URL/key and explicit isolation confirmation required.');
const origin=new URL(stageUrl);
const dbOrigin=new URL(supabaseUrl);
if(origin.protocol!=='https:' || !origin.hostname.endsWith('.vercel.app') ||
   origin.hostname.includes('git-main-') || /^(?:www\.)?aurotap\.in$/.test(origin.hostname) ||
   dbOrigin.protocol!=='https:' || dbOrigin.hostname.includes('mwfcwhxdlnqldciigicl'))
  throw new Error('BLOCKED: production deployment/database cannot be a staging test target.');
const bypass=process.env.VERCEL_AUTOMATION_BYPASS;
const users={
  customer:['PLATFORM_STAGE_CUSTOMER_EMAIL','PLATFORM_STAGE_CUSTOMER_PASSWORD'],
  supplier:['PLATFORM_STAGE_SUPPLIER_EMAIL','PLATFORM_STAGE_SUPPLIER_PASSWORD'],
  technician:['PLATFORM_STAGE_TECHNICIAN_EMAIL','PLATFORM_STAGE_TECHNICIAN_PASSWORD'],
  admin:['PLATFORM_STAGE_ADMIN_EMAIL','PLATFORM_STAGE_ADMIN_PASSWORD'],
};
const roleEndpoints={
  customer:'/api/customer/addresses',
  supplier:'/api/supplier/orders',
  technician:'/api/technician/jobs',
  admin:'/api/admin/users',
};
const tokens={};
for(const [role,keys] of Object.entries(users)) {
  const [email,password]=keys.map(k=>process.env[k]);
  if(!email || !password)throw new Error('BLOCKED: stage-only '+role+' credentials missing');
  const client=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error || !data.session?.access_token)throw new Error('Stage '+role+' login failed: fixture unavailable');
  tokens[role]=data.session.access_token;
}
async function get(path,token) {
  const response=await fetch(new URL(path,origin),{
    method:'GET',redirect:'manual',cache:'no-store',headers:{
      ...(token?{Authorization:`Bearer ${token}`}:{}),
      ...(bypass?{'x-vercel-protection-bypass':bypass}:{}),
    },
    signal:AbortSignal.timeout(12_000),
  });
  // No PII in CI logs.
  return {status:response.status,location:response.headers.get('location')};
}
let assertions=0;
for(const [owner,path] of Object.entries(roleEndpoints)) {
  // No token cannot read a protected role's data.
  const anonymous=await get(path,null);
  assert.ok([401,403].includes(anonymous.status),
    `[${owner}] anonymous GET must be denied; received ${anonymous.status}`);
  assertions++;
  // The owner must never receive 401/403; other server errors should ALSO
  // fail the gate, because an endpoint that's broken is not release ready.
  const allowed=await get(path,tokens[owner]);
  assert.equal(allowed.status,200,
    `[${owner}] authenticated GET ${path} must succeed on a valid fixture`);
  assertions++;
  for(const other of Object.keys(tokens).filter(x=>x!==owner)) {
    const denied=await get(path,tokens[other]);
    assert.ok([401,403].includes(denied.status),
      `[${other} -> ${owner}] invalid role was not denied at ${path}; status ${denied.status}`);
    assertions++;
  }
}
console.log('PASS: '+assertions+' read-only role/auth negative and positive HTTP assertions across 4 accounts and 4 protected APIs.');
console.log('No production database touched; no writes performed. This is NOT booking/payment end-to-end coverage.');
