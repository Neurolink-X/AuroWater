#!/usr/bin/env node
/**
 * Fast, dependency-free manifest/lock consistency gate.
 * npm ci is still the final authoritative dependency graph validation.
 */
import { readFileSync } from 'node:fs';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  } catch (error) {
    console.error(`Invalid or missing ${path}: ${error.message}`);
    process.exit(1);
  }
}

export function checkManifestLock(manifest, lock) {
  const errors = [];
  if (lock?.lockfileVersion !== 3 || !lock?.packages?.['']) {
    return ['package-lock.json must be lockfileVersion 3 with a root package entry'];
  }

  const root = lock.packages[''];
  for (const field of ['name', 'version']) {
    if (manifest[field] !== lock[field] || manifest[field] !== root[field]) {
      errors.push(`${field} differs between package.json and package-lock.json`);
    }
  }
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const expected = manifest[section] ?? {};
    const actual = root[section] ?? {};
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const name of [...keys].sort()) {
      if (expected[name] !== actual[name]) {
        errors.push(`${section}:${name} manifest=${JSON.stringify(expected[name] ?? null)} lock=${JSON.stringify(actual[name] ?? null)}`);
      }
    }
  }
  if (JSON.stringify(manifest.engines ?? {}) !== JSON.stringify(root.engines ?? {})) {
    errors.push('package engines metadata differs from lock root');
  }
  return errors;
}

const isMain = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (isMain) {
  const errors = checkManifestLock(readJson('package.json'), readJson('package-lock.json'));
  if (errors.length) {
    console.error('Dependency manifest/lock mismatch detected:');
    errors.forEach((e) => console.error(` - ${e}`));
    console.error('Fix: npm install --package-lock-only --ignore-scripts; commit package-lock.json; run npm ci.');
    process.exitCode = 1;
  } else {
    console.log('Root dependency manifest matches lockfile; npm ci verifies full dependency graph next.');
  }
}
