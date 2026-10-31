import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync('src/lib/borewell-estimate.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const testModule = { exports: {} };
new Function('module', 'exports', compiled)(testModule, testModule.exports);
const { estimateBorewell, BOREWELL_GUIDE } = testModule.exports;

test('4.5-inch 300 feet at 100 rupees gives 30000 drilling only', () => {
  const quote = estimateBorewell({ job: 'drilling', diameter: '4.5', depthFeet: 300, ratePerFoot: 100 });
  assert.equal(quote.subtotal, 30000);
  assert.equal(quote.requiresSiteQuote, true);
});
test('casing is calculated on casing feet, not all drilled feet', () => {
  const quote = estimateBorewell({ job: 'drilling', diameter: '4.5', depthFeet: 300, ratePerFoot: 100, casingFeet: 50, includePump: true });
  assert.equal(quote.subtotal, 55000);
});
test('diameter-specific rates are bounded', () => {
  assert.equal(BOREWELL_GUIDE.drilling['8'].min, 300);
  assert.throws(() => estimateBorewell({ job: 'drilling', diameter: '8', depthFeet: 300, ratePerFoot: 100 }), RangeError);
});
test('reject invalid depth and casing', () => {
  for (const depthFeet of [0, -1, 2001, 12.5, NaN, Infinity]) {
    assert.throws(() => estimateBorewell({ job: 'drilling', diameter: '4.5', depthFeet }), RangeError);
  }
  assert.throws(() => estimateBorewell({ job: 'drilling', diameter: '4.5', depthFeet: 300, casingFeet: 301 }), RangeError);
});
test('repair and inspection never invent a drilling price', () => {
  for (const job of ['repair', 'inspection']) assert.equal(estimateBorewell({ job, diameter: '4.5', depthFeet: 0 }).subtotal, 0);
});
