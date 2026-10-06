#!/usr/bin/env node
/**
 * Guards two production regressions without requiring a running app:
 * route groups must not create duplicate URL pages, and supplier dashboard
 * routes must remain protected by the proxy.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const appRoot = join(root, 'src', 'app');

function collectPages(directory, pages = []) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) collectPages(fullPath, pages);
    else if (entry === 'page.tsx') pages.push(fullPath);
  }
  return pages;
}

function routeFor(pagePath) {
  const parts = relative(appRoot, pagePath).split(sep).slice(0, -1);
  const routeParts = parts.filter((part) => !/^\(.+\)$/.test(part));
  return `/${routeParts.join('/')}`.replace(/\/$/, '') || '/';
}

const byRoute = new Map();
for (const page of collectPages(appRoot)) {
  const route = routeFor(page);
  byRoute.set(route, [...(byRoute.get(route) ?? []), relative(root, page)]);
}

const duplicates = [...byRoute.entries()].filter(([, pages]) => pages.length > 1);
assert.deepEqual(duplicates, [], `Duplicate App Router pages:\n${JSON.stringify(duplicates, null, 2)}`);

const proxySource = readFileSync(join(root, 'src', 'proxy.ts'), 'utf8');
assert.doesNotMatch(proxySource, /['"]\/supplier\/['"]/);
assert.match(proxySource, /prefix:\s*'\/supplier'/);
assert.match(proxySource, /pathname === g\.prefix \|\| pathname\.startsWith\(`\$\{g\.prefix\}\/`\)/);

const supplierDashboardSource = readFileSync(
  join(root, 'src', 'app', 'supplier', 'dashboard', 'page.tsx'),
  'utf8',
);
assert.match(supplierDashboardSource, /supplierOrderAccept/);
assert.match(supplierDashboardSource, /supplierOrderReject/);
assert.doesNotMatch(
  supplierDashboardSource,
  /supplierOrderUpdateStatus\([^\n]+['"]IN_PROGRESS['"]\)/,
);

const contactPageSource = readFileSync(
  join(root, 'src', 'app', '(public)', 'contact', 'page.tsx'),
  'utf8',
);
assert.match(contactPageSource, /postContact/);

const sitemapSource = readFileSync(join(root, 'src', 'app', 'sitemap.ts'), 'utf8');
for (const route of ['/services', '/pricing', '/how-it-works', '/about', '/contact']) {
  assert.match(sitemapSource, new RegExp(route.replace('/', '\\/')));
}



const supplierDispatchSource = readFileSync(
  join(root, 'src', 'lib', 'dispatch.ts'),
  'utf8',
);
assert.match(supplierDispatchSource, /order_dispatch/);
assert.match(supplierDispatchSource, /supplier_zones/);
assert.match(supplierDispatchSource, /attempt_no/);
assert.match(supplierDispatchSource, /reserve_supplier_stock/);

const supplierPayoutSource = readFileSync(
  join(root, 'src', 'app', 'api', 'supplier', 'payouts', 'route.ts'),
  'utf8',
);
assert.match(supplierPayoutSource, /create_supplier_payout_request/);

const supplierDashboardSource = readFileSync(
  join(root, 'src', 'app', 'supplier', 'dashboard', 'page.tsx'),
  'utf8',
);
assert.match(supplierDashboardSource, /accepted_at/);
assert.match(supplierDashboardSource, /supplier_payout/);
assert.doesNotMatch(supplierDashboardSource, /Account ending in XXXX4521/);
assert.doesNotMatch(supplierDashboardSource, /gst_cert\.pdf/);

const hardeningSql = readFileSync(
  join(root, 'sql', '016_supplier_operations_foundation.sql'),
  'utf8',
);
for (const token of [
  'CREATE TABLE IF NOT EXISTS public.service_zones',
  'CREATE TABLE IF NOT EXISTS public.supplier_zones',
  'CREATE TABLE IF NOT EXISTS public.order_dispatch',
  'customer_cancel_order',
  'create_supplier_payout_request',
  'orders_update_admin_only',
  'supplier_payout_rate_snapshot',
]) {
  assert.ok(hardeningSql.includes(token), \`Missing supplier hardening token: \${token}\`);
}

assert.match(
  readFileSync(join(root, 'src', 'app', 'api', 'customer', 'orders', '[id]', 'cancel', 'route.ts'), 'utf8'),
  /customer_cancel_order/,
);

console.log(`Route/access regression checks passed (${byRoute.size} page routes).`);
