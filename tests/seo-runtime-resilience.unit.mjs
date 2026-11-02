import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('homepage indexability follows production-only robots policy', () => {
  const home = read('../src/app/(public)/page.tsx');
  assert.match(home, /canIndexDeployment/);
  assert.match(home, /robots: allowIndexing/);
  assert.match(home, /index: false, follow: false/);
});

test('sitemap only publishes known editorial last-modified timestamps', () => {
  const sitemap = read('../src/app/sitemap.ts');
  assert.doesNotMatch(sitemap, /SITE_UPDATED|CONTENT_UPDATED/);
  assert.match(sitemap, /post\.updatedAt/);
  assert.match(sitemap, /item\.reviewed_at/);
  assert.match(sitemap, /canIndexDeployment/);
});

test('runtime telemetry sends role + allowlisted code only, no sensitive exception content', () => {
  const client = read('../src/components/observability/RuntimeErrorReporter.tsx');
  const endpoint = read('../src/app/api/internal/telemetry/web-vitals/route.ts');
  assert.match(client, /addEventListener\('unhandledrejection'/);
  assert.match(client, /addEventListener\('error'/);
  assert.match(client, /emitted >= 3/);
  assert.doesNotMatch(client, /JSON\.stringify\([\s\S]*?message:|stack:|reason:/);
  assert.match(endpoint, /ALLOWED_RUNTIME_ERRORS\.has\(name\) && value === 1/);
  assert.match(endpoint, /aurotap\.runtime_error/);
});

test('all public routes inherit preview-safe metadata, default brand is AuroTap', () => {
  const layout = read('../src/app/layout.tsx');
  assert.match(layout, /canIndexDeployment/);
  assert.match(layout, /robots: allowIndexing \?/);
  assert.match(layout, /googleBot: \{ index: false, follow: false \}/);
  assert.match(layout, /NEXT_PUBLIC_APP_NAME\?\.trim\(\) \|\| 'AuroTap'/);
});
