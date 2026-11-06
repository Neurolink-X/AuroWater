import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/layout/RootChrome.tsx', 'utf8');

test('role dashboard routes avoid static public navigation and footer imports', () => {
  assert.match(source, /import dynamic from 'next\/dynamic'/);
  for (const name of ['Header', 'Footer', 'WhatsAppFAB']) {
    assert.match(source, new RegExp(`const ${name} = dynamic\\(\\(\\) => import\\('`));
    assert.doesNotMatch(source, new RegExp(`import ${name} from ['\\"]`));
  }
  for (const role of ['/admin', '/technician', '/supplier', '/customer', '/auth']) {
    assert.ok(source.includes(`'${role}'`), `Missing private-route guard: ${role}`);
  }
  assert.ok(source.indexOf('if (suppressChrome)') < source.indexOf('<Header />'));
  assert.match(source, /<Header\s*\/>/);
  assert.match(source, /<Footer\s*\/>/);
  assert.match(source, /<WhatsAppFAB\s*\/>/);
});
