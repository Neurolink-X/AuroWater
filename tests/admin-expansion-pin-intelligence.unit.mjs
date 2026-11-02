import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const shell = read('src/components/admin/AdminShell.tsx');
const expansion = read('src/app/admin/expansion/page.tsx');
const postal = read('src/app/api/admin/postal-intelligence/route.ts');
const tool = read('src/components/admin/PostalIntelligenceTool.tsx');
const legacy = read('src/app/admin/postal-intelligence/page.tsx');
const publicPostal = read('src/app/api/geo/postal/route.ts');

test('admin sidebar consolidates navigation without deleting linked routes or quick search', () => {
  assert.match(shell, /PRIMARY_NAV_HREFS/);
  assert.match(shell, /PRIMARY_NAV = NAV.filter/);
  assert.match(shell, /MORE_TOOLS = NAV.filter/);
  assert.match(shell, /NAV.map\(\(item\) => \(\{/);
  assert.match(shell, /\/admin\/verification/);
  assert.match(shell, /\/admin\/postal-intelligence/);
  assert.match(shell, /\/admin\/city-readiness/);
  assert.match(shell, /\/admin\/zones/);
  assert.match(shell, /More tools/);
});

test('expansion integrates PIN tool and original postal route still works', () => {
  assert.match(expansion, /PostalIntelligenceTool/);
  assert.match(expansion, /import\('@\/components\/admin\/PostalIntelligenceTool'\)/);
  assert.match(legacy, /PostalIntelligenceTool/);
  assert.match(tool, /Matching zones/);
  assert.match(tool, /Potential water suppliers/);
});

test('PIN diagnostics are strictly admin-only, bounded, and do not infer bookability', () => {
  assert.match(postal, /requireAdmin\(auth.ctx\)/);
  assert.match(postal, /const PIN = \^/);
  assert.match(postal, /\.eq\('pincode', pin\)/);
  assert.match(postal, /\.contains\('pincodes', \[pin\]\)/);
  assert.match(postal, /\.limit\(LIMIT\)/);
  assert.match(postal, /\.limit\(MAX_ZONES\)/);
  assert.match(postal, /\.limit\(MAX_SUPPLIERS\)/);
  assert.match(postal, /delivery_bookable: null/);
  assert.match(postal, /supplier_signal_verified/);
  assert.doesNotMatch(postal, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(publicPostal, /const MAX_RESULTS = 50/);
});

test('postal data is not treated as proof of serviceability or payment', () => {
  assert.match(postal, /not a booking guarantee/i);
  assert.match(postal, /active_city_zones/);
  assert.match(postal, /stock/);
});
