#!/usr/bin/env node
/**
 * Read-only vulnerability inventory. Do not mutate the lockfile, silently
 * ignore audit errors, or apply breaking dependency upgrades in CI.
 * This reports production and development dependency risk separately.
 */
import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const severity = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };

function audit(scope, extra = []) {
  const result = spawnSync(npm, ['audit', '--json', ...extra], {
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 12 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw new Error(`npm audit failed to execute (${scope}): ${result.error.message}`);
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm audit did not return a readable JSON report (${scope}); exit ${result.status}`);
  }
  if (!report?.metadata?.vulnerabilities || !report.vulnerabilities || (result.status !== 0 && result.status !== 1)) {
    throw new Error(`npm audit did not complete successfully (${scope}); exit ${result.status}`);
  }
  const findings = Object.entries(report.vulnerabilities)
    .map(([name, detail]) => ({
      package: name,
      severity: detail.severity,
      direct: Boolean(detail.isDirect),
      range: detail.range,
      fixAvailable: detail.fixAvailable ?? false,
      via: (detail.via ?? []).map((item) => typeof item === 'string'
        ? item : { title: item.title, range: item.range, url: item.url }),
      affectedPaths: (detail.nodes ?? []).length,
    }))
    .sort((a, b) => (severity[b.severity] ?? -1) - (severity[a.severity] ?? -1) || a.package.localeCompare(b.package));
  const summary = {
    kind: 'npm-audit-inventory',
    scope,
    counts: report.metadata.vulnerabilities,
    findings,
    warning: 'Findings are not remediated by this read-only report. Do not merge with unreviewed high-severity risk.',
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  if ((summary.counts.high ?? 0) + (summary.counts.critical ?? 0) > 0) {
    process.stdout.write(`AUDIT_RISK ${scope}: ${summary.counts.high ?? 0} high, ${summary.counts.critical ?? 0} critical; review fixed versions and dependency paths.\n`);
  }
  return summary;
}

try {
  audit('all-dependencies');
  audit('production-dependencies', ['--omit=dev']);
} catch (error) {
  console.error('DEPENDENCY_AUDIT_UNVERIFIED', error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
