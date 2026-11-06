import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDesktop, markdown } from '../../scripts/report-lighthouse-desktop.mjs';

function makeReport({ tbt = 580, cls = 0.185, seo = 0.92 } = {}) {
  return {
    lighthouseVersion: '13.6.0',
    finalUrl: 'https://www.aurotap.in/',
    categories: {
      performance: { score: 0.65, auditRefs: [] },
      accessibility: { score: 0.97, auditRefs: [{ id: 'color-contrast' }] },
      'best-practices': { score: 1, auditRefs: [] },
      seo: { score: seo, auditRefs: [{ id: 'document-title' }] },
    },
    audits: {
      'first-contentful-paint': { numericValue: 300 },
      'largest-contentful-paint': { numericValue: 800 },
      'speed-index': { numericValue: 1600 },
      'total-blocking-time': { numericValue: tbt },
      'cumulative-layout-shift': { numericValue: cls },
      'color-contrast': { title: 'Contrast', score: 0, scoreDisplayMode: 'binary' },
      'document-title': { title: 'Title', score: 0, scoreDisplayMode: 'binary' },
      'mainthread-work-breakdown': { title: 'Main thread', numericValue: 3000, details: { items: [{ groupLabel: 'Script Evaluation', duration: 1101 }] } },
      'long-tasks': { title: 'Long tasks', details: { items: [{ duration: 188, url: 'https://aurotap.in/_next/chunks/app.js?cid=secret' }] } },
      'layout-shift-culprits': { title: 'Layout shift culprits', details: { items: [{ node: { snippet: '<div class="test">' }, layoutShiftScore: cls }] } },
    },
  };
}

test('desktop diagnostics use medians and good-performance thresholds', () => {
  const result = summarizeDesktop([
    makeReport({ tbt: 580, cls: 0.185 }),
    makeReport({ tbt: 400, cls: 0.12 }),
    makeReport({ tbt: 640, cls: 0.21 }),
  ]);
  assert.equal(result.metrics.TBT.median, 580);
  assert.equal(result.metrics.CLS.median, 0.185);
  assert.equal(result.metrics.TBT.passes, false);
  assert.equal(result.metrics.CLS.passes, false);
  assert.equal(result.metrics.LCP.passes, true);
  assert.equal(result.diagnostics[0].layout.id, 'layout-shift-culprits');
  assert.equal(result.diagnostics[0].mainThread.items[0].group, 'Script Evaluation');
  assert.equal(result.diagnostics[0].longTasks.items[0].resource, 'https://aurotap.in/_next/chunks/app.js');
  assert.ok(!markdown(result).includes('cid=secret'));
  assert.equal(result.failed.seo[0].count, 3);
});

test('an incomplete Lighthouse report must not fake a green run', () => {
  assert.throws(() => summarizeDesktop([]), /Lighthouse reports required/);
  assert.throws(() => summarizeDesktop([{ runtimeError: {}, categories: {}, audits: {} }]), /Incomplete/);
  const incomplete = makeReport();
  delete incomplete.audits['total-blocking-time'];
  const summary = summarizeDesktop([incomplete]);
  assert.equal(summary.metrics.TBT.median, null);
  assert.equal(summary.metrics.TBT.passes, null);
});
