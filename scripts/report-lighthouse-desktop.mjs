#!/usr/bin/env node
/**
 * Repeatable desktop Lighthouse analysis for production diagnostics.
 * This collects lab medians and bounded evidence; it never claims to measure
 * real-user Core Web Vitals or to validate unmerged code.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TARGETS = Object.freeze({
  'first-contentful-paint': ['FCP', 1800],
  'largest-contentful-paint': ['LCP', 2500],
  'total-blocking-time': ['TBT', 200],
  'cumulative-layout-shift': ['CLS', 0.1],
  'speed-index': ['Speed Index', 3400],
});
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

function median(numbers) {
  const values = numbers.filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return null;
  const n = Math.floor(values.length / 2);
  return values.length % 2 ? values[n] : (values[n - 1] + values[n]) / 2;
}

function safeEvidence(item) {
  // Only render node snippets and script origin/path; do not publish query values.
  const node = item?.node || item?.element || item?.source || {};
  const snippet = typeof node?.snippet === 'string' ? node.snippet.slice(0, 240) : '';
  const selector = typeof node?.selector === 'string' ? node.selector.slice(0, 180) : '';
  const result = { snippet, selector };
  for (const field of ['duration', 'startTime', 'total', 'score', 'layoutShiftScore', 'wastedMs']) {
    if (typeof item?.[field] === 'number') result[field] = item[field];
  }
  if (typeof item?.url === 'string') {
    try {
      const url = new URL(item.url);
      result.resource = url.origin + url.pathname;
    } catch { result.resource = item.url.split('?')[0].slice(0, 200); }
  }
  if (typeof item?.groupLabel === 'string') result.group = item.groupLabel.slice(0, 80);
  return result;
}

function details(report, key, max = 5) {
  const audit = report.audits?.[key];
  return {
    id: key,
    label: audit?.title || key,
    total: audit?.numericValue ?? null,
    items: (audit?.details?.items || []).slice(0, max).map(safeEvidence),
  };
}

export function summarizeDesktop(reports) {
  if (!Array.isArray(reports) || reports.length === 0) throw new Error('Lighthouse reports required');
  for (const [index, report] of reports.entries()) {
    if (!report?.audits || !report?.categories || report.runtimeError) {
      throw new Error('Incomplete Lighthouse report at index ' + index);
    }
  }
  const metrics = Object.fromEntries(Object.entries(TARGETS).map(([id, [label, target]]) => {
    const values = reports.map(report => report.audits[id]?.numericValue);
    const value = median(values);
    return [label, { median: value, samples: values, target, passes: value === null ? null : value <= target }];
  }));
  const categories = Object.fromEntries(CATEGORIES.map(id => [
    id, median(reports.map(report => Number.isFinite(report.categories[id]?.score)
      ? Math.round(report.categories[id].score * 100) : NaN)),
  ]));
  const failed = Object.fromEntries(CATEGORIES.filter(id => id !== 'performance').map(id => {
    const seen = new Map();
    for (const report of reports) for (const ref of (report.categories[id]?.auditRefs || [])) {
      const audit = report.audits[ref.id];
      if (typeof audit?.score !== 'number' || audit.score >= 1 ||
          ['manual', 'notApplicable', 'informative'].includes(audit.scoreDisplayMode)) continue;
      seen.set(ref.id, { id: ref.id, title: audit.title, count: (seen.get(ref.id)?.count || 0) + 1 });
    }
    return [id, [...seen.values()].sort((a, b) => b.count - a.count)];
  }));
  const diagnostics = reports.map(report => {
    // Lighthouse versions expose either layout-shift-culprits or legacy elements.
    const layoutId = ['layout-shift-culprits', 'layout-shift-elements', 'layout-shifts']
      .find(id => report.audits[id]?.details?.items?.length);
    return {
      layout: layoutId ? details(report, layoutId, 5) : null,
      mainThread: details(report, 'mainthread-work-breakdown', 9),
      longTasks: details(report, 'long-tasks', 5),
      scriptBootup: details(report, 'bootup-time', 6),
      unusedJavaScript: details(report, 'unused-javascript', 5),
      lighthouseVersion: report.lighthouseVersion || null,
      finalOrigin: (() => { try { return new URL(report.finalUrl).origin; } catch { return null; } })(),
    };
  });
  return {
    runCount: reports.length, metrics, categories, failed, diagnostics,
    note: 'Simulated desktop Lighthouse lab results from a GitHub runner; not equivalent to Google PSI or real-user p75. Target thresholds are good-performance ceilings, not an assertion of 100 scores.',
  };
}

export function markdown(summary) {
  const result = [
    '# AuroTap Desktop Lighthouse: 3-run diagnostics',
    '',
    '| Metric | Median | Target | Result |',
    '|---|---:|---:|---|',
  ];
  for (const [label, info] of Object.entries(summary.metrics)) {
    const format = n => n === null || !Number.isFinite(n) ? 'Unavailable' :
      label === 'CLS' ? String(Math.round(n * 10000) / 10000) : Math.round(n) + ' ms';
    result.push('| ' + label + ' | ' + format(info.median) + ' | ' + format(info.target) +
      ' | ' + (info.passes === null ? 'No data' : info.passes ? 'Good' : 'Investigate') + ' |');
  }
  result.push('', '| Category | Median score |', '|---|---:|');
  for (const [category, score] of Object.entries(summary.categories)) {
    result.push('| ' + category + ' | ' + (score ?? 'No data') + ' |');
  }
  for (const [category, failures] of Object.entries(summary.failed)) {
    result.push('', '## ' + category + ' scored failures');
    for (const audit of failures) result.push('- ' + audit.title + ' [' + audit.id + '] (' + audit.count + '/' + summary.runCount + ' runs)');
    if (!failures.length) result.push('None in lab runs.');
  }
  for (const [index, diag] of summary.diagnostics.entries()) {
    result.push('', '## Desktop run ' + (index + 1) + ' evidence');
    for (const key of ['layout', 'mainThread', 'longTasks', 'scriptBootup', 'unusedJavaScript']) {
      const record = diag[key];
      if (!record) continue;
      result.push('### ' + record.label);
      result.push('- numeric: ' + (record.total ?? 'N/A'));
      for (const item of record.items) result.push('- ' + JSON.stringify(item).slice(0, 350));
    }
  }
  result.push('', summary.note, '');
  return result.join('\n');
}

const entry = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (entry) {
  try {
    const inputs = process.argv.slice(2);
    if (!inputs.length) throw new Error('Usage: node scripts/report-lighthouse-desktop.mjs report1.json report2.json report3.json');
    const summary = summarizeDesktop(inputs.map(file => JSON.parse(readFileSync(file, 'utf8'))));
    const outputDir = resolve(process.env.LIGHTHOUSE_REPORT_DIR || '.lighthouse-desktop');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(resolve(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    const text = markdown(summary);
    writeFileSync(resolve(outputDir, 'summary.md'), text);
    process.stdout.write(text);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
