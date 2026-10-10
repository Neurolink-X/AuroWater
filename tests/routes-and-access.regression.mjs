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

// Pricing integrity guards: the customer API must validate and persist its own total,
 // and public water-can pricing must match the API's launch rates.
const orderApi = readFileSync(join(root, 'src', 'app', 'api', 'customer', 'orders', 'route.ts'), 'utf8');
assert.match(orderApi, /totalsMatch\(clientTotal, base_amount, convenience, emergency_charge, gstRate, 0\.5\)/);
assert.match(orderApi, /const total = computeExpectedTotal\(base_amount, convenience, emergency_charge, gstRate\)\.total/);
assert.doesNotMatch(orderApi, /const total = round2\(clientTotal\)/);

const pricingPage = readFileSync(join(root, 'src', 'app', '(public)', 'pricing', 'page.tsx'), 'utf8');
assert.match(pricingPage, /const NORMAL_RO_PRICE = 20/);
assert.match(pricingPage, /const CHILLED_RO_PRICE = 25/);
assert.match(pricingPage, /const RECURRING_RO_PRICE = 18/);
assert.match(pricingPage, /price: 'Quote required'/);

console.log(`Route/access and pricing integrity regression checks passed (${byRoute.size} page routes).`);
