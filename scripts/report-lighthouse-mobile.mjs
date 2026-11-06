#!/usr/bin/env node
/**
 * Median of repeat Lighthouse mobile runs, with actionable failing-audit IDs.
 * Diagnostic only: simulated lab data are NOT real-user p75 Core Web Vitals.
 * Usage: node scripts/report-lighthouse-mobile.mjs .lighthouse/mobile-*.json
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const METRICS = Object.freeze({
  'first-contentful-paint': { label: 'FCP', unit: 'ms', target: 1000 },
  'largest-contentful-paint': { label: 'LCP', unit: 'ms', target: 1500 },
  'total-blocking-time': { label: 'TBT', unit: 'ms', target: 50 },
  'cumulative-layout-shift': { label: 'CLS', unit: '', target: 0.01 },
  'speed-index': { label: 'Speed Index', unit: 'ms', target: 2000 },
});
const SCORE_CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function failedAudits(lhr, category) {
  return (lhr.categories?.[category]?.auditRefs ?? [])
    .map(ref => ({ audit: lhr.audits?.[ref.id], id: ref.id }))
    .filter(({ audit }) => audit && typeof audit.score === 'number' && audit.score < 1 &&
      !['manual', 'notApplicable', 'informative'].includes(audit.scoreDisplayMode))
    .map(({ audit, id }) => ({
      id,
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue ?? '',
      explanation: audit.explanation ?? '',
      // Public anonymous audit evidence, bounded to avoid huge CI summaries.
      evidence: (audit.details?.items ?? []).slice(0, 2).map(item =>
        JSON.stringify(item).slice(0, 500)),
    }));
}

export function summarizeLighthouse(reports) {
  if (!Array.isArray(reports) || !reports.length) throw new Error('At least one Lighthouse JSON report is required');
  for (const [i, r] of reports.entries()) {
    if (!r || !r.audits || !r.categories || r.runtimeError) {
      throw new Error('Invalid or incomplete Lighthouse report at index ' + i);
    }
  }
  const metrics = Object.fromEntries(Object.entries(METRICS).map(([key, target]) => {
    const samples = reports.map(r => r.audits[key]?.numericValue).filter(Number.isFinite);
    const value = median(samples);
    return [target.label, { median: value, samples, target: target.target, unit: target.unit,
      passes: value === null ? null : value <= target.target }];
  }));
  const categories = Object.fromEntries(SCORE_CATEGORIES.map(id => {
    const samples = reports.map(r => r.categories[id]?.score).filter(Number.isFinite).map(n => Math.round(n * 100));
    return [id, { median: median(samples), samples }];
  }));
  const failures = Object.fromEntries(['best-practices', 'accessibility', 'seo'].map(id => {
    const occurrences = new Map();
    for (const report of reports) for (const audit of failedAudits(report, id)) {
      const prev = occurrences.get(audit.id);
      occurrences.set(audit.id, { ...audit, runs: (prev?.runs ?? 0) + 1 });
    }
    return [id, [...occurrences.values()].sort((a, b) => b.runs - a.runs || a.score - b.score)];
  }));
  const diagnostics = reports.map(r => ({
    lcpElement: r.audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet ?? null,
    finalUrl: r.finalDisplayedUrl ?? r.finalUrl ?? null,
    lighthouseVersion: r.lighthouseVersion ?? null,
  }));
  return { runCount: reports.length, categories, metrics, failures, diagnostics,
    note: 'Simulated Lighthouse lab medians, not real-user 75th-percentile measurements. Goals are ambitious, not guaranteed.' };
}

function render(summary) {
  const rows = [
    '# AuroTap Mobile Lighthouse — repeated-run diagnostic',
    '',
    'Runs: ' + summary.runCount,
    '',
    '| Metric | Median | Practical goal | Status |',
    '|---|---:|---:|---|',
  ];
  for (const [name, metric] of Object.entries(summary.metrics)) {
    const unit = metric.unit === 'ms' ? 'ms' : '';
    rows.push('| ' + name + ' | ' + (metric.median ?? 'No data') + unit +
      ' | ≤' + metric.target + unit + ' | ' + (metric.passes === null ? 'No data' : metric.passes ? 'Within goal' : 'Investigate') + ' |');
  }
  rows.push('', '| Category | Median score |', '|---|---:|');
  for (const [name, category] of Object.entries(summary.categories)) {
    rows.push('| ' + name + ' | ' + (category.median ?? 'No data') + ' |');
  }
  for (const [category, failures] of Object.entries(summary.failures)) {
    rows.push('', '## ' + category + ': failing audits');
    if (!failures.length) rows.push('No scored failing audits detected.');
    else for (const audit of failures) {
      rows.push('- ' + audit.id + ' (' + audit.runs + '/' + summary.runCount + ' runs): ' +
        audit.title + (audit.displayValue ? ' — ' + audit.displayValue : ''));
      for (const evidence of audit.evidence) rows.push('  - Evidence: ' + evidence);
    }
  }
  rows.push('', '## LCP element attribution (when exposed by Lighthouse)');
  for (const [i, report] of summary.diagnostics.entries()) rows.push('- Run ' + (i + 1) + ': ' + (report.lcpElement ?? 'Not available'));
  rows.push('', summary.note, '');
  return rows.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error('Usage: node scripts/report-lighthouse-mobile.mjs report1.json report2.json [report3.json]');
    process.exitCode = 2;
  } else {
    try {
      const reports = paths.map(path => JSON.parse(readFileSync(path, 'utf8')));
      const summary = summarizeLighthouse(reports);
      const outDir = process.env.LIGHTHOUSE_REPORT_DIR || '.lighthouse';
      mkdirSync(outDir, { recursive: true });
      const markdown = render(summary);
      writeFileSync(resolve(outDir, 'summary.md'), markdown);
      writeFileSync(resolve(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
      console.log(markdown);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  }
}
