#!/usr/bin/env node
/**
 * Dependency-free unit tests for SEO indexing policy.
 * Requires the repository's Node 24 CI runtime.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canIndexDeployment, createRobotsPolicy } from '../src/lib/seo-policy.ts';

test('only production deployments may be indexed', () => {
  assert.equal(canIndexDeployment({ vercelEnv: 'production', nodeEnv: 'production' }), true);
  assert.equal(canIndexDeployment({ vercelEnv: 'preview', nodeEnv: 'production' }), false);
  assert.equal(canIndexDeployment({ vercelEnv: 'development', nodeEnv: 'development' }), false);
  assert.equal(canIndexDeployment({ vercelEnv: 'production', nodeEnv: 'production', allowIndexing: 'false' }), false);
  assert.equal(canIndexDeployment({ vercelEnv: 'production', nodeEnv: 'test' }), false);
  assert.equal(canIndexDeployment({ nodeEnv: 'production' }), false);
});

test('non-production robots policy blocks crawling and omits sitemap', () => {
  assert.deepEqual(createRobotsPolicy(false, 'https://aurotap.in'), {
    rules: [{ userAgent: '*', disallow: '/' }],
  });
});

test('production robots policy keeps public pages crawlable and blocks private areas', () => {
  const policy = createRobotsPolicy(true, 'https://aurotap.in/');
  assert.equal(policy.sitemap, 'https://aurotap.in/sitemap.xml');
  const rule = policy.rules[0];
  assert.equal(rule.userAgent, '*');
  assert.equal(rule.allow, '/');
  for (const path of [
    '/admin', '/admin/', '/customer', '/customer/', '/supplier',
    '/technician/', '/dashboard', '/auth/', '/api', '/api/',
    '/internal/', '/private/',
  ]) assert.ok(rule.disallow.includes(path), `missing private disallow: ${path}`);
  assert.ok(!rule.disallow.includes('/_next/'), 'do not block Next assets needed for rendering');
});

test('robots and sitemap use the shared production indexing policy', () => {
  const robots = readFileSync(new URL('../src/app/robots.ts', import.meta.url), 'utf8');
  const sitemap = readFileSync(new URL('../src/app/sitemap.ts', import.meta.url), 'utf8');
  assert.match(robots, /canIndexDeployment/);
  assert.match(robots, /createRobotsPolicy/);
  assert.match(sitemap, /canIndexDeployment/);
  assert.match(sitemap, /return \[\]/);
  assert.match(sitemap, /serviceDetailPages/);
  assert.match(sitemap, /publicPages/);
});
