import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function isIgnored(path) {
  try {
    execFileSync('git', ['check-ignore', '--no-index', '--quiet', '--', path], {
      cwd: root, stdio: 'pipe',
    });
    return true;
  } catch (error) {
    if (error?.status === 1) return false;
    throw error;
  }
}

const requiredTrackedPaths = [
  'package.json',
  'package-lock.json',
  'eslint-suppressions.json',
  '.github/workflows/codeql.yml',
  '.github/workflows/auto-repair-safe.yml',
  '.github/workflows/water-news-discovery.yml',
  '.github/workflows/editorial-evergreen-publish.yml',
  '.github/scripts/verify-suppression-prune.mjs',
  'scripts/auto-publish-water-news.mjs',
  'scripts/setup-db.js',
  'tests/unit/repository-source-integrity.test.mjs',
  'src/data/water-news-reviewed.json',
  'content/water-news-drafts.json',
  'content/water-news-drafts.quarantine.json',
  'sql/001_core_schema.sql',
  'supabase/migrations/20261102103000_consistent_public_order_references.sql',
  'docs/DATABASE_SCHEMA_RECOVERY.md',
];
const protectedPrivatePaths = [
  '.env',
  '.env.local',
  '.env.production',
  'credentials.json',
  'service-account-prod.json',
  'private-key.pem',
  'artifacts/db-readiness/report.json',
  'node_modules/private/module.js',
  '.next/server/routes-manifest.json',
];

test('critical repository paths cannot be accidentally ignored', () => {
  for (const path of requiredTrackedPaths) {
    assert.equal(isIgnored(path), false, `Required path unexpectedly ignored: ${path}`);
  }
});

test('secrets, local artifacts and dependencies remain ignored', () => {
  for (const path of protectedPrivatePaths) {
    assert.equal(isIgnored(path), true, `Private path unexpectedly unignored: ${path}`);
  }
});

test('editorial workflow executables exist at the exact referenced paths', () => {
  const entrypoint = 'scripts/auto-publish-water-news.mjs';
  assert.ok(existsSync(resolve(root, entrypoint)), `Missing: ${entrypoint}`);
  for (const path of [
    '.github/workflows/water-news-discovery.yml',
    '.github/workflows/editorial-evergreen-publish.yml',
  ]) {
    const yaml = readFileSync(resolve(root, path), 'utf8');
    assert.ok(yaml.includes(`node ${entrypoint}`), `Workflow does not call ${entrypoint}: ${path}`);
    assert.ok(!yaml.includes('node scripts/publish-water-news.mjs'), `Legacy script reference: ${path}`);
  }
});

test('database readiness must remain read-only and migration review separate', () => {
  const code = readFileSync(resolve(root, 'scripts/setup-db.js'), 'utf8');
  assert.match(code, /BEGIN TRANSACTION READ ONLY/);
  assert.match(code, /ROLLBACK/);
  assert.match(code, /DATABASE_SCHEMA_RECOVERY\.md/);
  assert.match(code, /DB_READINESS_REPORT_PATH/);
});
