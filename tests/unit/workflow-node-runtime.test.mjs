import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('all GitHub Actions setup-node jobs use the same supported Node major as package.json', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(manifest.engines.node, '24.x');
  const directory = '.github/workflows';
  let checked = 0;
  for (const name of readdirSync(directory).filter((value) => /\.ya?ml$/.test(value))) {
    const source = readFileSync(join(directory, name), 'utf8');
    if (!/actions\/setup-node@/.test(source)) continue;
    const requested = [...source.matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => Number(m[1]));
    assert.ok(requested.length, `Missing pinned Node major in ${name}`);
    for (const major of requested) {
      assert.equal(major, 24, `Incompatible Node major in ${name}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 8, 'Expected coverage of CI, staging and scheduled workflows');
});
