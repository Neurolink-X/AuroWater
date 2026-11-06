import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const expected = Object.freeze({
  'node_modules/source-map-js': [1, 2, 2],
  'node_modules/flatted': [3, 4, 2],
  'node_modules/js-yaml': [4, 3, 2],
  'node_modules/tinyglobby/node_modules/picomatch': [4, 0, 4],
  'node_modules/brace-expansion': [1, 1, 21],
  'node_modules/minimatch': [3, 1, 4],
});

function compareVersions(actual, required) {
  const parts = actual.split('.').map(Number);
  assert.equal(parts.length, 3, 'Expected a lockfile exact semver');
  for (let i = 0; i < required.length; i++) {
    if (parts[i] !== required[i]) return parts[i] - required[i];
  }
  return 0;
}

test('security patches retain compatible transitive lockfile versions', () => {
  for (const [key, minVersion] of Object.entries(expected)) {
    const entry = lock.packages[key];
    assert.ok(entry, `Missing dependency: ${key}`);
    assert.ok(compareVersions(entry.version, minVersion) >= 0, `${key} below security floor`);
    assert.match(entry.resolved, /^https:\/\/registry\.npmjs\.org\//);
    assert.match(entry.integrity, /^sha512-/);
  }
});

test('production source-map patched without altering declared parent dependency contracts', () => {
  assert.equal(lock.packages['node_modules/@tailwindcss/node'].dependencies['source-map-js'], '^1.2.1');
  assert.equal(lock.packages['node_modules/postcss'].dependencies['source-map-js'], '^1.2.1');
  assert.equal(lock.packages['node_modules/source-map-js'].version, '1.2.2');
});
