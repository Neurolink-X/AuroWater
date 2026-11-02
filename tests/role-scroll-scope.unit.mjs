import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('marketing-only scroll observers never run on private dashboards', () => {
  const component = read('../src/components/ScrollReveal.tsx');
  const hook = read('../src/hooks/useScrollAnimation.ts');
  assert.match(component, /NON_MARKETING_PREFIXES/);
  for (const prefix of ['/admin', '/customer', '/supplier', '/technician']) {
    assert.ok(component.includes(`'${prefix}'`));
  }
  assert.match(component, /useScrollAnimation\(\{ enabled \}\)/);
  assert.match(hook, /if \(!enabled\)/);
  assert.match(hook, /root\.removeAttribute\('data-reveal-ready'\)/);
});

test('supplier fallback reads skip offline tabs, with online reconnect still enabled', () => {
  const hook = read('../src/hooks/useSupplierRealtime.ts');
  assert.match(hook, /document\.visibilityState === 'visible' && navigator\.onLine/);
  assert.match(hook, /addEventListener\('online', onOnline\)/);
});
