#!/usr/bin/env node
/**
 * Platform-wide, fail-closed quality contract.
 *
 * Two independent gates:
 *   1. Known critical journeys: role->API->auth->dependent state->UI routes.
 *   2. PR impact: each high-risk domain edited in the PR MUST include a
 *      domain-relevant regression test change (not an unrelated green test).
 *
 * This is STATIC + repository-level testing, NOT live authenticated E2E.
 * All checks use only Node built-ins and run offline on every CI job.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DOMAIN_CONTRACTS = Object.freeze({
  auth: {
    owner: 'All roles',
    purpose: 'Login, session lifecycle, role isolation and authorization',
    source: ['src/app/api/auth/login/route.ts', 'src/lib/api-client.ts'],
    tests: ['tests/routes-and-access.regression.mjs'],
    testName: /(?:auth|session|login|role|access|security|permissions)/i,
    sourceName: /(?:^src\/(?:app\/api\/auth\/|app\/auth\/|hooks\/useAuth|lib\/(?:api-client|auth\/|api\/supabase-request))|^src\/proxy\.ts)/,
  },
  booking: {
    owner: 'Customer → Supplier/Technician → Admin',
    purpose: 'Selected address, location eligibility, price and booking receipt',
    source: ['src/app/api/customer/orders/route.ts', 'src/app/api/customer/addresses/route.ts'],
    tests: ['tests/address-maintenance-commission-integrity.unit.mjs'],
    testName: /(?:booking|order|address|serviceability|pricing|zones|maintenance)/i,
    sourceName: /(?:^src\/app\/(?:customer\/|api\/customer\/(?:orders|addresses|serviceability)\/)|^src\/lib\/(?:address|zones|geo|api\/order-pricing))/i,
  },
  supplier: {
    owner: 'Supplier → Dispatch → Customer',
    purpose: 'Supplier ownership, stock, acceptance and assigned order',
    source: ['src/app/api/supplier/orders/route.ts'],
    tests: ['tests/dispatch-retry-settings-efficiency.unit.mjs'],
    testName: /(?:supplier|dispatch|stock|payout|partner|capacity|coverage)/i,
    sourceName: /(?:^src\/app\/(?:supplier\/|api\/supplier\/)|^src\/lib\/(?:supplier|dispatch))/i,
  },
  technician: {
    owner: 'Technician/Plumber → Admin',
    purpose: 'KYC, service eligibility, job accept, completion and availability',
    source: ['src/app/api/technician/jobs/route.ts', 'src/app/api/technician/service-applications/route.ts', 'src/app/api/technicians/documents/route.ts', 'src/app/api/technician/availability/route.ts'],
    tests: ['tests/technician-service-approval-flow.unit.mjs'],
    testName: /(?:technician|plumber|specialist|kyc|service-approval|job|capabilit)/i,
    sourceName: /(?:^src\/app\/(?:technician\/|api\/technician\/|api\/technicians\/|register\/pro\/)|^src\/(?:components\/technician\/|lib\/technician))/i,
  },
  admin: {
    owner: 'Admin → Every operational role',
    purpose: 'Approvals, identity checks, account actions and audit trail',
    source: ['src/app/api/admin/users/route.ts', 'src/app/api/admin/partner-applications/route.ts'],
    tests: ['tests/routes-and-access.regression.mjs'],
    testName: /(?:admin|approval|verification|account|recovery|role|security)/i,
    sourceName: /(?:^src\/app\/(?:admin\/|api\/admin\/)|^src\/components\/admin\/)/i,
  },
  pricing: {
    owner: 'Admin pricing → Customer checkout → Ledger',
    purpose: 'Published prices, server recalculation and consistent totals',
    source: ['src/app/api/admin/pricing/route.ts', 'src/app/api/customer/orders/route.ts'],
    tests: ['tests/address-maintenance-commission-integrity.unit.mjs'],
    testName: /(?:pricing|price|commission|surcharge|total|finance|payment|ledger)/i,
    sourceName: /(?:^src\/lib\/pricing\/|^src\/app\/api\/admin\/pricing\/|^src\/lib\/api\/order-pricing|^src\/app\/api\/(?:pricing|payment|finance)\/)/i,
  },
  subscriptions: {
    owner: 'Customer → Supplier → Payments',
    purpose: 'Recurring order safety, pause/resume, duplicate prevention',
    source: ['src/app/api/customer/subscriptions/route.ts'],
    tests: ['tests/routes-and-access.regression.mjs'],
    testName: /(?:subscription|recurr|schedule|order|payment)/i,
    sourceName: /(?:^src\/app\/(?:api\/.*subscription|customer\/.*subscription)|^src\/lib\/.*subscription)/i,
  },
  dispatch: {
    owner: 'Customer order → Eligible Supplier/Technician',
    purpose: 'Correct city, distance, role capacity, retry and queue ownership',
    source: ['src/app/api/supplier/orders/route.ts', 'src/app/api/technician/jobs/route.ts'],
    tests: ['tests/dispatch-retry-settings-efficiency.unit.mjs', 'tests/dispatch-work-queue.unit.mjs'],
    testName: /(?:dispatch|queue|retry|assign|capacity|radius|coverage|zone)/i,
    sourceName: /(?:^src\/lib\/dispatch|^src\/app\/api\/.*(?:dispatch|assign|retry|queue|zones)\/)/i,
  },
  notifications: {
    owner: 'Customer, Supplier, Technician and Admin',
    purpose: 'In-app notifications, job alerts, push opt-in/out, retention',
    source: ['src/app/api/notifications/push/route.ts', 'src/app/notifications/page.tsx'],
    tests: ['tests/notification-retention-integrity.unit.mjs'],
    testName: /(?:notification|push|alert|outbox|retention|web-push)/i,
    sourceName: /(?:^src\/app\/(?:notifications\/|api\/.*(?:notification|push)\/)|^src\/lib\/.*(?:notification|push))/i,
  },
  finance: {
    owner: 'Supplier/Technician → Admin',
    purpose: 'Ledger, payout eligibility and exactly-once settlement',
    source: ['src/app/api/admin/orders/route.ts'],
    tests: ['tests/address-maintenance-commission-integrity.unit.mjs'],
    testName: /(?:finance|ledger|payout|payment|earning|commission|settle|refund)/i,
    sourceName: /(?:^src\/app\/(?:api\/.*(?:finance|payout|wallet|payment|refund|earning)\/|supplier\/.*(?:payout|earning))|^src\/lib\/.*(?:finance|ledger|payout|payment))/i,
  },
});

export const PROTECTED_APIS = Object.freeze([
  ['src/app/api/customer/orders/route.ts', 'customer'],
  ['src/app/api/customer/addresses/route.ts', 'customer'],
  ['src/app/api/supplier/orders/route.ts', 'supplier'],
  ['src/app/api/technician/jobs/route.ts', 'technician'],
  ['src/app/api/technician/service-applications/route.ts', 'technician'],
  ['src/app/api/technician/availability/route.ts', 'technician'],
  ['src/app/api/technicians/documents/route.ts', 'technician'],
  ['src/app/api/admin/users/route.ts', 'admin'],
  ['src/app/api/admin/partner-applications/route.ts', 'admin'],
  ['src/app/api/admin/pricing/route.ts', 'admin'],
  ['src/app/api/notifications/push/route.ts', 'authenticated'],
  ['src/app/api/customer/subscriptions/route.ts', 'customer_or_supplier'],
]);

export const CRITICAL_LINKS = Object.freeze([
  ['src/components/technician/SpecialistStatusPanel.tsx', '/technician/services/apply'],
  ['src/app/register/pro/page.tsx', '/technician/services/apply'],
  ['src/app/technician/services/apply/page.tsx', '/notifications'],
  ['src/app/technician/services/apply/page.tsx', '/technician/dashboard'],
  ['src/app/admin/users/page.tsx', '/admin/verification'],
]);

const normalizePath = p => p.replaceAll('\\', '/').replace(/^\.\//, '');
// Explicit cross-role propagation. An order/assignment/financial change can
// pass its own unit test yet break the next actor in the transaction.
const CROSS_ROLE_IMPACT = Object.freeze([
  { path: /^src\/app\/api\/customer\/orders\/route\.ts$/, domains: ['booking','pricing','dispatch','supplier','technician','notifications','finance'] },
  { path: /^src\/app\/api\/supplier\/orders\/route\.ts$/, domains: ['supplier','dispatch','booking','finance','notifications'] },
  { path: /^src\/app\/api\/technician\/jobs\/route\.ts$/, domains: ['technician','dispatch','booking','notifications','finance'] },
  { path: /^src\/app\/api\/admin\/pricing\/route\.ts$/, domains: ['admin','pricing','booking','subscriptions','finance'] },
  { path: /^src\/app\/api\/admin\/partner-applications\/route\.ts$/, domains: ['admin','technician','auth','notifications'] },
  { path: /^src\/app\/api\/technician\/service-applications\/route\.ts$/, domains: ['technician','admin','auth','notifications'] },
  { path: /^src\/app\/api\/customer\/subscriptions\/route\.ts$/, domains: ['subscriptions','booking','supplier','finance','notifications'] },
]);
export function domainsForChangedPath(file) {
  const path = normalizePath(file);
  if (path.startsWith('supabase/migrations/')) return Object.keys(DOMAIN_CONTRACTS);
  const direct=Object.entries(DOMAIN_CONTRACTS)
    .filter(([, cfg]) => cfg.sourceName.test(path)).map(([id]) => id);
  const propagated=CROSS_ROLE_IMPACT.filter(flow=>flow.path.test(path)).flatMap(flow=>flow.domains);
  return [...new Set([...direct,...propagated])];
}

export function requiredTestEvidence(changed) {
  const changedFiles = [...new Set(changed.map(normalizePath))];
  const runtime = changedFiles.filter(p => /^(src\/|supabase\/migrations\/)/.test(p) && /\.(?:tsx?|sql)$/.test(p));
  const relevant = new Set(runtime.flatMap(domainsForChangedPath));
  const tests = changedFiles.filter(p => /^tests\/.*\.(?:mjs|js|ts|tsx)$/.test(p));
  const missing = [...relevant].filter(id => !tests.some(t => DOMAIN_CONTRACTS[id].testName.test(t)));
  // No blind spot: unmapped runtime files must be covered by a generic test
  // AND explicitly mapped before CI can pass. This evolves with the app.
  const unmapped = runtime.filter(p => domainsForChangedPath(p).length === 0);
  return { runtime, domains:[...relevant], tests, missing, unmapped };
}

function collectRoutes(root=ROOT) {
  const app=join(root, 'src', 'app');
  const routes=new Set();
  function walk(directory, prefix=[]) {
    for (const entry of readdirSync(directory, { withFileTypes:true })) {
      if(entry.isDirectory()) {
        if(entry.name.startsWith('@')) continue;
        walk(join(directory,entry.name), /^\(.*\)$/.test(entry.name) ? prefix : [...prefix,entry.name]);
      } else if (entry.name==='page.tsx' || entry.name==='page.ts' || entry.name==='route.ts') {
        routes.add('/'+prefix.join('/'));
      }
    }
  }
  walk(app);
  return routes;
}
export function hasRoute(target, routes) {
  const path=target.split(/[?#]/)[0].replace(/\/$/,'')||'/';
  if(routes.has(path))return true;
  const pathSegments=path.split('/').filter(Boolean);
  return [...routes].some(route=>{
    const parts=route.split('/').filter(Boolean);
    return parts.length===pathSegments.length && parts.every((part,i)=>part.startsWith('[')&&part.endsWith(']') || part===pathSegments[i]);
  });
}
export function verifyPlatformContracts(root=ROOT) {
  const failures=[];
  const slurp=p=>readFileSync(join(root,p),'utf8');
  for(const [name,contract] of Object.entries(DOMAIN_CONTRACTS)) {
    for(const file of [...contract.source,...contract.tests]) {
      if(!existsSync(join(root,file)))failures.push(`[${name}] expected owned source/test missing: ${file}`);
    }
  }
  for(const [file,role] of PROTECTED_APIS) {
    if(!existsSync(join(root,file))) {failures.push(`[role ${role}] route removed: ${file}`);continue;}
    const code=slurp(file);
    if(!/requireSupabaseAuth\s*\(/.test(code))failures.push(`[${role}] API missing session check: ${file}`);
    if(role==='admin' && !/requireAdmin\s*\(/.test(code))failures.push(`[admin] API missing admin check: ${file}`);
    if(role==='technician' && !/requireRole\s*\(|\['technician', 'plumber'\]/.test(code))failures.push(`[technician] missing role authorization: ${file}`);
    if(role==='supplier' && !/requireRole\s*\(/.test(code))failures.push(`[supplier] missing role authorization: ${file}`);
  }
  const routes=collectRoutes(root);
  for(const [source,destination] of CRITICAL_LINKS) {
    if(!existsSync(join(root,source))) {failures.push(`[navigation] source missing: ${source}`);continue;}
    const code=slurp(source);
    if(!code.includes(`href="${destination}"`))failures.push(`[navigation] missing ${destination} link in ${source}`);
    if(!hasRoute(destination,routes))failures.push(`[navigation] link points to missing route ${destination}`);
  }
  return failures;
}

export function changedPaths(base,head='HEAD') {
  if(!/^[0-9a-fA-F]{7,64}$/.test(base) || !/^(HEAD|[0-9a-fA-F]{7,64})$/.test(head)) {
    throw new Error('Invalid Git revision arguments');
  }
  const range=`${base}...${head}`;
  return execFileSync('git',['diff','--name-only','--diff-filter=ACMR',range],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);
}
export function enforceChangeImpact(paths) {
  const summary=requiredTestEvidence(paths);
  const problems=[
    ...summary.unmapped.map(p=>`Unmapped runtime change: ${p}. Add this route/library to an owned domain in scripts/platform-quality-contract.mjs.`),
    ...summary.missing.map(d=>`Domain "${d}" changed but no domain-specific test changed. Update/add tests matching ${DOMAIN_CONTRACTS[d].testName}.`),
  ];
  return {summary,problems};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const failures=verifyPlatformContracts();
  const base=process.env.PLATFORM_DIFF_BASE?.trim();
  const impact=base ? enforceChangeImpact(changedPaths(base)) : null;
  if(impact) failures.push(...impact.problems);
  for(const item of failures) console.error('FAIL',item);
  console.log(JSON.stringify({
    domains:Object.keys(DOMAIN_CONTRACTS).length,
    roleProtectedApis:PROTECTED_APIS.length,
    criticalLinks:CRITICAL_LINKS.length,
    changedDomains:impact?.summary.domains??'full-contract-only',
    runtimeChanges:impact?.summary.runtime.length??'N/A',
    failures:failures.length,
    execution:'static contracts + PR impact; not real staging E2E',
  },null,2));
  if(failures.length) process.exitCode=1;
}
