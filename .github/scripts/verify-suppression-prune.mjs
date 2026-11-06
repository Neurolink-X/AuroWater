#!/usr/bin/env node
/**
 * Verify ESLint bulk suppressions changed by pruning ONLY.
 * No added file/rule, no increased count, no unknown metadata.
 *
 * Usage:
 * node .github/scripts/verify-suppression-prune.mjs \
 *   --old=before.json --new=eslint-suppressions.json [--summary=report.md]
 *
 * Prints `semantic_change=true|false` to GITHUB_OUTPUT when available.
 */
import { readFileSync, statSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 5 * 1024 * 1024;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validateKey(key, label) {
  if (typeof key !== 'string' || !key.trim() || key.length > 1024 || CONTROL.test(key)) {
    throw new Error(`${label}: empty, oversized, or contains control characters`);
  }
}

/** Strict ESLint shape: { "file": { "rule": { "count": positiveSafeInt } } }. */
export function load(path) {
  const size = statSync(path).size;
  if (size > MAX_BYTES) throw new Error(`${path} is larger than ${MAX_BYTES} bytes`);

  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path} is unreadable or invalid JSON: ${error.message}`);
  }

  if (!isObject(data)) throw new Error(`${path}: top level must be an object`);

  const result = new Map();

  for (const [file, rules] of Object.entries(data)) {
    validateKey(file, 'File key');

    if (!isObject(rules) || Object.keys(rules).length === 0) {
      throw new Error(`${path}: ${file} must contain at least one rule`);
    }

    const ruleMap = new Map();

    for (const [rule, metadata] of Object.entries(rules)) {
      validateKey(rule, `Rule key in ${file}`);

      if (
        !isObject(metadata) ||
        Object.keys(metadata).length !== 1 ||
        !Object.hasOwn(metadata, 'count') ||
        !Number.isSafeInteger(metadata.count) ||
        metadata.count < 1
      ) {
        throw new Error(`${path}: invalid count or unexpected metadata at ${file} / ${rule}`);
      }

      ruleMap.set(rule, metadata.count);
    }

    result.set(file, ruleMap);
  }

  return result;
}

export function comparePrune(before, after) {
  const violations = [];
  const stats = {
    filesRemoved: 0,
    rulesRemoved: 0,
    countsLowered: 0,
    before: 0,
    after: 0
  };

  for (const rules of before.values()) {
    for (const count of rules.values()) stats.before += count;
  }

  for (const rules of after.values()) {
    for (const count of rules.values()) stats.after += count;
  }

  for (const [file, rules] of after) {
    const previous = before.get(file);

    if (!previous) {
      violations.push(`Added file: ${file}`);
      continue;
    }

    for (const [rule, count] of rules) {
      const prior = previous.get(rule);

      if (prior === undefined) {
        violations.push(`Added rule: ${file} / ${rule}`);
      } else if (count > prior) {
        violations.push(`Raised count: ${file} / ${rule} (${prior} -> ${count})`);
      }
    }
  }

  for (const [file, rules] of before) {
    const current = after.get(file);

    if (!current) {
      stats.filesRemoved++;
      stats.rulesRemoved += rules.size;
      continue;
    }

    for (const [rule, prior] of rules) {
      const count = current.get(rule);

      if (count === undefined) {
        stats.rulesRemoved++;
      } else if (count < prior) {
        stats.countsLowered++;
      }
    }
  }

  stats.semanticChange =
    stats.filesRemoved > 0 ||
    stats.rulesRemoved > 0 ||
    stats.countsLowered > 0;

  return { violations, stats };
}

function option(args, name) {
  return args
    .find(entry => entry.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

export function runCli(args = process.argv.slice(2)) {
  const oldPath = option(args, 'old');
  const newPath = option(args, 'new');
  const summaryPath = option(args, 'summary');

  if (!oldPath || !newPath) {
    throw new Error('Usage: --old=<file> --new=<file> [--summary=<file>]');
  }

  const { violations, stats } = comparePrune(
    load(oldPath),
    load(newPath)
  );

  if (violations.length) {
    throw new Error(
      `Not a pure prune (${violations.length} violation(s)):\n` +
      violations.slice(0, 30).join('\n')
    );
  }

  const summary = [
    '### ESLint suppression cleanup',
    '',
    `- Files removed: **${stats.filesRemoved}**`,
    `- Rule entries removed: **${stats.rulesRemoved}**`,
    `- Counts lowered: **${stats.countsLowered}**`,
    `- Total suppressed violations: **${stats.before} → ${stats.after}**`,
    `- Meaningful cleanup: **${stats.semanticChange ? 'yes' : 'no'}**`,
    ''
  ].join('\n');

  process.stdout.write(summary);

  if (summaryPath) writeFileSync(summaryPath, summary);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `semantic_change=${stats.semanticChange}\n`
    );
  }

  return stats;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    runCli();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
