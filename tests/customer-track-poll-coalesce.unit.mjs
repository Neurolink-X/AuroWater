import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/app/customer/track/[id]/page.tsx', import.meta.url), 'utf8');
assert.match(source, /lastAutomaticFetchAt/);
assert.match(source, /15_000/);
assert.match(source, /loadPromise\.current/);
assert.match(source, /if \(loadPromise\.current\) return loadPromise\.current/);
console.log('Tracking refresh guard regression passed.');
