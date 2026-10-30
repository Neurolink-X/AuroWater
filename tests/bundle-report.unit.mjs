import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/report-client-bundle-budget.mjs', import.meta.url));
function fixture(t, missingChunk = false) {
  const root = mkdtempSync(join(tmpdir(), 'aurotap-bundle-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, content) => {
    const target = join(root, '.next', path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
  };
  put('build-manifest.json', JSON.stringify({ pages: { '/_app': ['static/shared.js'] }, rootMainFiles: ['static/shared.js'] }));
  put('app-path-routes-manifest.json', JSON.stringify({ '/(supplier)/supplier/[id]/page': '/supplier/[id]', '/api/test/route': '/api/test' }));
  put('server/app/(supplier)/supplier/[id]/page_client-reference-manifest.js', 'globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/(supplier)/supplier/[id]/page"]=' + JSON.stringify({ clientModules: { a: { chunks: ['123', 'static/%5Bid%5D.js'] }, b: { chunks: ['123', 'static/%5Bid%5D.js'] } } }));
  put('static/shared.js', 'console.log("shared");');
  if (!missingChunk) put('static/[id].js', 'console.log("route");');
  return root;
}

test('Next 16 fallback reports App Router routes, decoded chunks and correct role budgets', (t) => {
  const result = spawnSync(process.execPath, [script], { cwd: fixture(t), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.slice(0, result.stdout.lastIndexOf('}') + 1));
  assert.equal(report.measurement, 'referenced-client-chunks');
  assert.equal(report.route_count, 1);
  assert.equal(report.routes[0].route, '/supplier/[id]');
  assert.equal(report.routes[0].group, 'supplier');
  assert.equal(report.routes[0].chunks, 2);
  assert.ok(report.routes[0].gzip_kb > 0);
});

test('missing chunks fail instead of silently reporting an artificially small bundle', (t) => {
  const result = spawnSync(process.execPath, [script], { cwd: fixture(t, true), encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing or invalid client chunk/);
});
