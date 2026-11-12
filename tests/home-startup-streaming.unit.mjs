import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { PassThrough } from 'node:stream';
import { createElement } from 'react';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToPipeableStream } from 'react-dom/server';
import ts from 'typescript';

// Render the actual page composition with only its external boundaries stubbed.
// A city query that has not resolved must not withhold the usable home shell.
function loadPage(getCities) {
  const source = readFileSync('src/app/(public)/page.tsx', 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const compiled = { exports: {} };
  const modules = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    './HomeClient': { default: () => createElement('a', { href: '/book' }, 'Book water now') },
    '@/lib/marketing-pricing': { SITE: { name: 'AuroTap', url: 'https://www.aurotap.in', social: [] }, FAQS: [], MAX_LOCK_MONTHS: 12 },
    '@/lib/public-city-directory.server': { getPublicServiceCities: getCities },
    '@/lib/seo-policy': { canIndexDeployment: () => true },
  };
  vm.runInNewContext(output, {
    module: compiled, exports: compiled.exports, URL, process: { env: {} },
    require: name => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
  });
  return compiled.exports.default;
}

test('home shell streams before a slow city query, then preserves current city SEO', { timeout: 5000 }, async () => {
  let release;
  let settled = false;
  const cities = new Promise(resolve => { release = resolve; });
  const Page = loadPage(() => cities);
  let html = '';
  const output = new PassThrough();
  let shellReady;
  const shell = new Promise(resolve => { shellReady = resolve; });
  const finished = new Promise((resolve, reject) => {
    output.on('data', chunk => { html += chunk; });
    output.on('end', resolve); output.on('error', reject);
  });
  const stream = renderToPipeableStream(createElement('html', null, createElement('body', null, createElement(Page))), {
    bootstrapScripts: ['/_next/static/test-runtime.js'],
    onShellReady() { stream.pipe(output); shellReady(); },
    onError(error) { output.destroy(error); },
  });
  try {
    await shell;
    await new Promise(resolve => { setImmediate(resolve); });
    assert.equal(settled, false);
    assert.match(html, /Book water now/);
    assert.match(html, /href="\/book"/);
    release([{ name: 'Kanpur', slug: 'kanpur', status: 'active' },
      { name: 'Upcoming city', slug: 'upcoming', status: 'waitlist' }]);
    settled = true;
    await finished;
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /"name":"Kanpur"/);
    assert.doesNotMatch(html, /"name":"Upcoming city"/);
  } finally { stream.abort(); }
});

test('city-directory outage does not remove the usable home shell or invent coverage', async () => {
  const Page = loadPage(async () => []);
  const output = new PassThrough();
  let html = '';
  const finished = new Promise((resolve, reject) => {
    output.on('data', chunk => { html += chunk; });
    output.on('end', resolve); output.on('error', reject);
  });
  const stream = renderToPipeableStream(createElement(Page), {
    onShellReady() { stream.pipe(output); }, onError(error) { output.destroy(error); },
  });
  await finished;
  assert.match(html, /Book water now/);
  assert.match(html, /"areaServed":\[\]/);
});

test('home directory refresh runs on mount with bounded, cancellable, nonoverlapping requests', () => {
  const home = readFileSync('src/app/(public)/HomeClient.tsx', 'utf8');
  assert.match(home, /refresh\(\);\s*const onFocus/);
  assert.match(home, /if \(pending\) return/);
  assert.match(home, /setTimeout\(\(\) => controller\.abort\(\), 8_000\)/);
  assert.match(home, /window\.clearTimeout\(timeout\)/);
  assert.match(home, /pending\?\.abort\(\)/);
  assert.match(home, /Checking current city coverage/);
  assert.match(home, /setDirectoryState\('error'\)/);
});
