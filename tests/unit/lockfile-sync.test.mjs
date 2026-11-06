import test from 'node:test';
import assert from 'node:assert/strict';
import { checkManifestLock } from '../../scripts/check-lockfile-sync.mjs';

const manifest = {
  name: 'test-app',
  version: '1.0.0',
  engines: { node: '>=22' },
  dependencies: { react: '^19.0.0' },
  devDependencies: { eslint: '^9.0.0' }
};

const lock = {
  name: 'test-app',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: {
    '': {
      name: 'test-app',
      version: '1.0.0',
      engines: { node: '>=22' },
      dependencies: { react: '^19.0.0' },
      devDependencies: { eslint: '^9.0.0' }
    }
  }
};

test('accepts matching lockfile root metadata', () => {
  assert.deepEqual(checkManifestLock(manifest, lock), []);
});

test('rejects missing or stale dependencies', () => {
  const old = structuredClone(lock);
  old.packages[''].dependencies.react = '^18.0.0';
  old.packages[''].devDependencies = {};
  assert.ok(checkManifestLock(manifest, old).length >= 2);
});

test('rejects unexpected direct dependency', () => {
  const changed = structuredClone(lock);
  changed.packages[''].dependencies.unexpected = '^1.0.0';
  assert.match(checkManifestLock(manifest, changed).join(' '), /unexpected/);
});

test('rejects outdated engines and malformed lockfile', () => {
  const changed = structuredClone(lock);
  changed.packages[''].engines.node = '>=20';
  assert.match(checkManifestLock(manifest, changed).join(' '), /engines/);
  assert.match(checkManifestLock(manifest, {}).join(' '), /lockfileVersion/);
});
