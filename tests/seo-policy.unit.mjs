#!/usr/bin/env node
/**
 * Dependency-free unit tests for the shared SEO indexing policy.
 * Run with: npm run test:unit
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../src/lib/seo-policy.ts', import.meta.url), 'utf8');
const compiled = await transform(source, { loader: 'ts', format: 'esm' });
const policyUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`;
const { shouldAllowIndexing, normalizeSiteUrl, isPrivateOrNonPublicPath } = await import(policyUrl);

test('indexing is allowed only for production unless explicitly disabled', () => {
  assert.equal(shouldAllowIndexing({ vercelEnv: 'production' }), true);
  assert.equal(shouldAllowIndexing({ vercelEnv: 'preview', nodeEnv: 'production' }), false);
  assert.equal(shouldAllowIndexing({ nodeEnv: 'development' }), false);
  assert.equal(shouldAllowIndexing({ vercelEnv: 'production', allowIndexing: 'false' }), false);
  assert.equal(shouldAllowIndexing({ vercelEnv: 'production', allowIndexing: 'FALSE' }), true);
});

test('site URL normalization produces a stable origin URL', () => {
  assert.equal(normalizeSiteUrl(' aurotap.in/ '), 'https://aurotap.in');
  assert.equal(normalizeSiteUrl('https://aurotap.in///'), 'https://aurotap.in');
  assert.equal(normalizeSiteUrl('http://localhost:3000/'), 'http://localhost:3000');
  assert.throws(() => normalizeSiteUrl(''), /must not be empty/);
  assert.throws(() => normalizeSiteUrl('http://aurotap.in'), /must use HTTPS/);
});

test('private routes are blocked by path segment, not substring', () => {
  for (const path of [
    '/admin', '/admin/orders', '/customer/', '/supplier/coverage',
    '/technician/jobs', '/dashboard', '/api/customer/orders',
    '/internal/health', '/private', '/_next/static/app.js',
  ]) assert.equal(isPrivateOrNonPublicPath(path), true, path);

  for (const path of [
    '/', '/water-delivery', '/water-delivery/kanpur',
    '/customer-care', '/administration-tips', '/services/plumbing',
  ]) assert.equal(isPrivateOrNonPublicPath(path), false, path);
});

test('robots and sitemap remain present in app router', () => {
  const robots = readFileSync(new URL('../src/app/robots.ts', import.meta.url), 'utf8');
  const sitemap = readFileSync(new URL('../src/app/sitemap.ts', import.meta.url), 'utf8');
  assert.match(robots, /shouldAllowIndexing/);
  assert.match(robots, /disallow:\s*\['\/']|disallow:\s*'\/'/);
  assert.match(sitemap, /shouldAllowIndexing/);
  assert.match(sitemap, /serviceDetailPages/);
  assert.match(sitemap, /publicPages/);
});
