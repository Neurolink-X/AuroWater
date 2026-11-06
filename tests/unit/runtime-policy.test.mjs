import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

test('Vercel and CI use the same supported Node major, never a floating new major', () => {
  assert.equal(manifest.engines.node, '24.x');
  assert.equal(lock.packages[''].engines.node, manifest.engines.node);
  assert.equal(manifest.engines.npm, lock.packages[''].engines.npm);
});

test('audit reporter remains read-only and analyzes production separately', () => {
  const source = readFileSync('scripts/audit-dependency-risk.mjs', 'utf8');
  assert.match(source, /'audit', '--json'/);
  assert.match(source, /'--omit=dev'/);
  assert.doesNotMatch(source, /\baudit fix\b|npm install|--force/);
  assert.match(source, /High\/critical advisories anywhere/);
  assert.match(source, /process\.exitCode = 1/);
});
