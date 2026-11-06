import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('bundle diagnostics separate shared referenced chunks from route-unique ones', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aurotap-bundle-'));
  try {
    mkdirSync(join(tmp, '.next', 'static', 'chunks'), { recursive: true });
    writeFileSync(join(tmp, '.next', 'build-manifest.json'), JSON.stringify({
      pages: {
        '/about': ['static/chunks/shared.js', 'static/chunks/about.js'],
        '/customer/home': ['static/chunks/shared.js', 'static/chunks/customer.js'],
      },
    }));
    for (const [file, value] of [['shared.js', 'A'.repeat(400)], ['about.js', 'B'.repeat(130)], ['customer.js', 'C'.repeat(130)]]) {
      writeFileSync(join(tmp, '.next', 'static', 'chunks', file), value);
    }
    const script = resolve('scripts/report-client-bundle-budget.mjs');
    const result = spawnSync(process.execPath, [script, '--summary'], { cwd: tmp, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    const reportLine = result.stdout.split('\n').find((line) => line.startsWith('BUNDLE_SUMMARY '));
    assert.ok(reportLine, result.stdout);
    const summary = JSON.parse(reportLine.slice('BUNDLE_SUMMARY '.length));
    assert.equal(summary.route_count, 2);
    assert.equal(summary.measurement, 'entry-chunks');
    assert.match(summary.limitations, /Not initial-load/);
    assert.equal(summary.group_counts.public.routes, 1);
    assert.equal(summary.group_counts.customer.routes, 1);
    assert.equal(summary.largest_route_unique.length, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
