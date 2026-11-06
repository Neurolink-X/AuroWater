import { withinSupplierRadius } from '../src/lib/dispatch-radius.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = readFileSync(join(root, 'src/lib/dispatch-radius.ts'), 'utf8');
assert.match(source, /distanceKm <= selectedRadiusKm/);



test('supplier 5km selection is a hard limit, not 15km fallback', () => {
  assert.equal(withinSupplierRadius(1.34, 5), true);
  assert.equal(withinSupplierRadius(5, 5), true);
  assert.equal(withinSupplierRadius(5.01, 5), false);
  assert.equal(withinSupplierRadius(10, 5), false);
  assert.equal(withinSupplierRadius(15, 5), false);
});

test('invalid coordinates and invalid radius fail closed', () => {
  for (const bad of [NaN, Infinity, -1]) assert.equal(withinSupplierRadius(bad, 5), false);
  for (const bad of [NaN, Infinity, 0, -5]) assert.equal(withinSupplierRadius(1, bad), false);
});
