
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, comparePrune } from './verify-suppression-prune.mjs';

function fileFor(value) {
  const directory = mkdtempSync(join(tmpdir(), 'aurotap-eslint-prune-'));
  const file = join(directory, 'suppressions.json');

  writeFileSync(file, JSON.stringify(value));

  return {
    file,
    cleanup: () => rmSync(directory, { recursive: true, force: true })
  };
}

function compare(before, after) {
  const a = fileFor(before);
  const b = fileFor(after);

  try {
    return comparePrune(load(a.file), load(b.file));
  } finally {
    a.cleanup();
    b.cleanup();
  }
}

const source = {
  'src/a.ts': {
    'no-undef': { count: 3 },
    'prefer-const': { count: 1 }
  },
  'src/b.tsx': {
    'react-hooks/rules-of-hooks': { count: 2 }
  }
};

test('valid prune can remove files, rules and lower counts', () => {
  const { violations, stats } = compare(source, {
    'src/a.ts': { 'no-undef': { count: 2 } }
  });

  assert.deepEqual(violations, []);
  assert.equal(stats.filesRemoved, 1);
  assert.equal(stats.rulesRemoved, 2);
  assert.equal(stats.countsLowered, 1);
  assert.equal(stats.semanticChange, true);
});

test('unchanged content produces no semantic change', () => {
  assert.equal(compare(source, source).stats.semanticChange, false);
});

test('empty store is allowed after complete pruning', () => {
  assert.equal(compare(source, {}).stats.semanticChange, true);
});

test('rejects newly added file', () => {
  const result = compare(source, {
    ...source,
    'src/new.ts': { 'no-undef': { count: 1 } }
  });

  assert.match(result.violations.join(' '), /Added file/);
});

test('rejects newly added rule', () => {
  const newer = structuredClone(source);
  newer['src/a.ts']['no-console'] = { count: 1 };

  assert.match(compare(source, newer).violations.join(' '), /Added rule/);
});

test('rejects raised count', () => {
  const newer = structuredClone(source);
  newer['src/a.ts']['no-undef'].count = 4;

  assert.match(compare(source, newer).violations.join(' '), /Raised count/);
});

test('rejects unexpected fields', () => {
  const item = fileFor({
    file: {
      rule: { count: 1, extra: true }
    }
  });

  try {
    assert.throws(() => load(item.file), /unexpected metadata/);
  } finally {
    item.cleanup();
  }
});

test('rejects zero, fractional and unsafe counts', () => {
  for (const count of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const item = fileFor({ file: { rule: { count } } });

    try {
      assert.throws(() => load(item.file), /invalid count/);
    } finally {
      item.cleanup();
    }
  }
});

test('rejects empty rule maps and empty keys', () => {
  for (const content of [
    { 'src/a.ts': {} },
    { '': { rule: { count: 1 } } },
    { file: { '': { count: 1 } } }
  ]) {
    const item = fileFor(content);

    try {
      assert.throws(() => load(item.file));
    } finally {
      item.cleanup();
    }
  }
});

test('rejects oversized input', () => {
  const item = fileFor({ file: { rule: { count: 1 } } });

  try {
    writeFileSync(item.file, ' '.repeat(5 * 1024 * 1024 + 1));
    assert.throws(() => load(item.file), /larger than/);
  } finally {
    item.cleanup();
  }
});
