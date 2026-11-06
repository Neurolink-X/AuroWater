import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLighthouse } from '../../scripts/report-lighthouse-mobile.mjs';

function report(lcp, speedIndex, bestPracticeScore = 0) {
  return {
    lighthouseVersion: '13.6.0',
    categories: {
      performance: { score: 0.96, auditRefs: [] },
      accessibility: { score: 0.97, auditRefs: [{ id: 'color-contrast' }] },
      'best-practices': { score: 0.92, auditRefs: [{ id: 'errors-in-console' }] },
      seo: { score: 1, auditRefs: [] },
    },
    audits: {
      'first-contentful-paint': { numericValue: 1400 },
      'largest-contentful-paint': { numericValue: lcp },
      'total-blocking-time': { numericValue: 20 },
      'cumulative-layout-shift': { numericValue: 0.007 },
      'speed-index': { numericValue: speedIndex },
      'errors-in-console': { score: bestPracticeScore, title: 'Browser errors were logged', scoreDisplayMode: 'binary' },
      'color-contrast': { score: 0, title: 'Contrast issue', scoreDisplayMode: 'binary' },
    },
  };
}

test('three mobile runs are compared by median rather than one noisy speed index', () => {
  const summary = summarizeLighthouse([
    report(1500, 4700), report(1700, 4200), report(1300, 5400),
  ]);
  assert.equal(summary.runCount, 3);
  assert.equal(summary.metrics.LCP.median, 1500);
  assert.equal(summary.metrics['Speed Index'].median, 4700);
  assert.equal(summary.metrics['Speed Index'].passes, false);
  assert.equal(summary.metrics.CLS.passes, true);
  assert.equal(summary.categories.performance.median, 96);
  assert.equal(summary.failures['best-practices'][0].id, 'errors-in-console');
  assert.equal(summary.failures['best-practices'][0].runs, 3);
});

test('no fabricated pass when metrics or audits are missing', () => {
  const minimal = report(1500, 4700, 1);
  delete minimal.audits['speed-index'];
  const summary = summarizeLighthouse([minimal]);
  assert.equal(summary.metrics['Speed Index'].median, null);
  assert.equal(summary.metrics['Speed Index'].passes, null);
  assert.equal(summary.failures['best-practices'].length, 0);
});

test('incomplete lighthouse runs reject instead of reporting a misleading median', () => {
  assert.throws(() => summarizeLighthouse([]), /At least one/);
  assert.throws(() => summarizeLighthouse([{ runtimeError: { code: 'NO_FCP' }, audits: {}, categories: {} }]), /incomplete/);
});
