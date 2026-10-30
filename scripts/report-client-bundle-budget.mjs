#!/usr/bin/env node
/**
 * Reports gzip transfer size of client JS chunks per App Router route.
 * Informational by default; set AUROWATER_ENFORCE_BUNDLE_BUDGET=1 only after
 * reviewing a production baseline and tuning route-group budgets.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const nextDir = resolve(root, '.next');
const manifestPath = [
  resolve(nextDir, 'app-build-manifest.json'),
  resolve(nextDir, 'build-manifest.json'),
].find(existsSync);

if (!manifestPath) {
  console.warn('Bundle report skipped: Next.js build manifest not found. Run after npm run build.');
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const routes = manifest.pages && typeof manifest.pages === 'object' ? manifest.pages : {};
const budgetsKb = { public: 250, customer: 350, supplier: 400, technician: 400, admin: 450 };
const results = [];

function groupFor(route) {
  const value = String(route).replace(/^\/+/, '');
  if (value.startsWith('admin/')) return 'admin';
  if (value.startsWith('supplier/') || value.startsWith('seller/')) return 'supplier';
  if (value.startsWith('technician/') || value.startsWith('agent/')) return 'technician';
  if (value.startsWith('customer/')) return 'customer';
  return 'public';
}

for (const [route, files] of Object.entries(routes)) {
  if (!Array.isArray(files)) continue;
  const chunks = [...new Set(files.filter((file) => typeof file === 'string' && file.endsWith('.js')))];
  let bytes = 0;
  for (const file of chunks) {
    const absolute = resolve(nextDir, file.replace(/^\/+/, ''));
    if (!absolute.startsWith(nextDir + sep) || !existsSync(absolute)) continue;
    bytes += gzipSync(readFileSync(absolute)).byteLength;
  }
  if (chunks.length) {
    const group = groupFor(route);
    const kb = Math.round((bytes / 1024) * 10) / 10;
    results.push({ route, group, gzip_kb: kb, budget_kb: budgetsKb[group], exceeded: kb > budgetsKb[group], chunks: chunks.length });
  }
}

results.sort((a, b) => b.gzip_kb - a.gzip_kb);
console.log(JSON.stringify({ report: 'route-client-js-gzip', manifest: manifestPath.slice(root.length + 1), routes: results }, null, 2));

const exceeded = results.filter((row) => row.exceeded);
if (exceeded.length) {
  console.warn('Client bundle budgets exceeded on ' + exceeded.length + ' route(s). Review lazy loading and client component boundaries.');
  if (process.env.AUROWATER_ENFORCE_BUNDLE_BUDGET === '1') process.exitCode = 1;
} else {
  console.log('All measured route bundles are within the current informational budgets.');
}
