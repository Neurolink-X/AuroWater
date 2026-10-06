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

console.log(`Route/access regression checks passed (${byRoute.size} page routes).`);
