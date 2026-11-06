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
  resolve(nextDir, 'server', 'app-build-manifest.json'),
  resolve(nextDir, 'app-build-manifest.json'),
  resolve(nextDir, 'build-manifest.json'),
].find(existsSync);

if (!manifestPath) {
  console.warn('Bundle report skipped: Next.js build manifest not found. Run after npm run build.');
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let routes = manifest.pages && typeof manifest.pages === 'object' ? manifest.pages : {};
const budgetsKb = { public: 250, customer: 350, supplier: 400, technician: 400, admin: 450 };
const results = [];
const sharedFiles = [
  ...(Array.isArray(manifest.rootMainFiles) ? manifest.rootMainFiles : []),
  ...(Array.isArray(manifest.polyfillFiles) ? manifest.polyfillFiles : []),
].filter((file) => typeof file === 'string' && file.endsWith('.js'));

// Next 16 webpack builds may omit app-build-manifest.json. The Pages Router
// fallback contains only /_app and cannot represent application route coverage.
const appRoutesPath = resolve(nextDir, 'app-path-routes-manifest.json');
let measurement = 'entry-chunks';
if (existsSync(appRoutesPath)) {
  const appRoutes = JSON.parse(readFileSync(appRoutesPath, 'utf8'));
  const appResults = {};
  for (const [entry, route] of Object.entries(appRoutes)) {
    if (!entry.endsWith('/page') || typeof route !== 'string') continue;
    const referencePath = resolve(nextDir, 'server', 'app', entry.replace(/^\/+/, '') + '_client-reference-manifest.js');
    if (!referencePath.startsWith(nextDir + sep) || !existsSync(referencePath)) {
      throw new Error('Missing App Router client manifest for ' + route);
    }
    const source = readFileSync(referencePath, 'utf8');
    // Parse only the JSON assignment; never evaluate generated JavaScript.
    const assignment = source.indexOf(']=');
    if (assignment < 0) throw new Error('Unsupported client manifest format for ' + route);
    const reference = JSON.parse(source.slice(assignment + 2).trim().replace(/;$/, ''));
    if (!reference.clientModules || typeof reference.clientModules !== 'object') {
      throw new Error('Missing client module inventory for ' + route);
    }
    const chunks = Object.values(reference.clientModules).flatMap((module) =>
      module && Array.isArray(module.chunks) ? module.chunks.filter((file) => typeof file === 'string' && file.endsWith('.js')) : []);
    appResults[route] = [...(appResults[route] ?? []), ...chunks];
  }
  if (!Object.keys(appResults).length) throw new Error('No App Router pages measured');
  routes = appResults;
  // Includes referenced/lazy chunks: conservative inventory, NOT initial load
  // bytes or a browser speed score. Keep budgets informational until calibrated.
  measurement = 'referenced-client-chunks';
}
const gzipSizes = new Map();

function groupFor(route) {
  const value = String(route).replace(/^\/+/, '');
  if (value.startsWith('admin/')) return 'admin';
  if (value.startsWith('supplier/') || value.startsWith('seller/')) return 'supplier';
  if (value.startsWith('technician/') || value.startsWith('agent/')) return 'technician';
  if (value.startsWith('customer/')) return 'customer';
  return 'public';
}

// Count each chunk once per route. Referenced chunks may be lazy and are NOT
// equivalent to initially downloaded JS; shared/unique labels are diagnostic.
const normalizedRoutes = new Map();
const usage = new Map();
for (const [route, files] of Object.entries(routes)) {
  if (!Array.isArray(files)) continue;
  const chunks = [...new Set([...sharedFiles, ...files.filter((f) => typeof f === 'string' && f.endsWith('.js'))])];
  normalizedRoutes.set(route, chunks);
  for (const chunk of chunks) usage.set(chunk, (usage.get(chunk) ?? 0) + 1);
}

for (const [route, chunks] of normalizedRoutes) {
  let bytes = 0;
  let sharedBytes = 0;
  let uniqueBytes = 0;
  for (const file of chunks) {
    const absolute = resolve(nextDir, decodeURIComponent(file).replace(/^\/+/, ''));
    if (!absolute.startsWith(nextDir + sep) || !existsSync(absolute)) {
      throw new Error('Missing or invalid client chunk: ' + file);
    }
    if (!gzipSizes.has(absolute)) gzipSizes.set(absolute, gzipSync(readFileSync(absolute)).byteLength);
    const chunkBytes = gzipSizes.get(absolute);
    bytes += chunkBytes;
    if ((usage.get(file) ?? 0) > 1) sharedBytes += chunkBytes;
    else uniqueBytes += chunkBytes;
  }
  if (chunks.length) {
    const group = groupFor(route);
    const kb = Math.round((bytes / 1024) * 10) / 10;
    results.push({ route, group, gzip_kb: kb, budget_kb: budgetsKb[group], exceeded: kb > budgetsKb[group], chunks: chunks.length,
      shared_referenced_gzip_kb: Math.round(sharedBytes / 1024 * 10) / 10,
      route_unique_referenced_gzip_kb: Math.round(uniqueBytes / 1024 * 10) / 10 });
  }
}

results.sort((a, b) => b.gzip_kb - a.gzip_kb);
const report = { report: 'route-client-js-gzip', measurement, route_count: results.length,
  manifest: manifestPath.slice(root.length + 1),
  methodology: 'Referenced gzip chunks (includes lazy chunks). Not initial-load bytes, real-user Core Web Vitals, or a performance score.',
  routes: results };
if (process.argv.includes('--summary')) {
  console.log('BUNDLE_SUMMARY ' + JSON.stringify({
    report: report.report, measurement, route_count: results.length,
    exceeded_count: results.filter((row) => row.exceeded).length,
    group_counts: Object.fromEntries([...new Set(results.map((r) => r.group))].map((group) => [
      group, { routes: results.filter((r) => r.group === group).length,
        exceeded: results.filter((r) => r.group === group && r.exceeded).length },
    ])),
    largest_route_unique: [...results].sort((a, b) => b.route_unique_referenced_gzip_kb - a.route_unique_referenced_gzip_kb).slice(0, 12)
      .map(({ route, route_unique_referenced_gzip_kb }) => ({ route, route_unique_referenced_gzip_kb })),
    limitations: report.methodology,
  }));
} else {
  console.log(JSON.stringify(report, null, 2));
}

const exceeded = results.filter((row) => row.exceeded);
if (exceeded.length) {
  console.warn('Client bundle budgets exceeded on ' + exceeded.length + ' route(s). Review lazy loading and client component boundaries.');
  if (process.env.AUROWATER_ENFORCE_BUNDLE_BUDGET === '1') process.exitCode = 1;
} else {
  console.log('All measured route bundles are within the current informational budgets. This is not a runtime speed measurement.');
}
