import test from 'node:test';
import assert from 'node:assert/strict';
import { canIndexDeployment, createRobotsPolicy } from '../../src/lib/seo-policy.ts';

test('only Vercel production with production Node environment can be indexed', () => {
  assert.equal(canIndexDeployment({ vercelEnv: 'production', nodeEnv: 'production' }), true);
  assert.equal(canIndexDeployment({ vercelEnv: 'preview', nodeEnv: 'production' }), false);
  assert.equal(canIndexDeployment({ vercelEnv: 'development', nodeEnv: 'development' }), false);
  assert.equal(canIndexDeployment({ nodeEnv: 'production' }), false);
  assert.equal(canIndexDeployment({ vercelEnv: 'production', nodeEnv: 'production', allowIndexing: 'false' }), false);
});

test('non-production robots policy blocks crawling and does not publish a sitemap', () => {
  const policy = createRobotsPolicy(false, 'https://preview.example.com');
  assert.deepEqual(policy, { rules: [{ userAgent: '*', disallow: '/' }] });
});

test('production robots policy protects private routes but leaves Next.js assets crawlable', () => {
  const policy = createRobotsPolicy(true, 'https://aurotap.in/');
  const rule = policy.rules[0];
  const blocked = rule.disallow;

  assert.equal(policy.sitemap, 'https://aurotap.in/sitemap.xml');
  assert.ok(Array.isArray(blocked));
  for (const path of ['/admin', '/customer/', '/supplier', '/technician', '/api']) {
    assert.ok(blocked.includes(path), `expected ${path} to remain private`);
  }
  assert.ok(!blocked.includes('/_next/'), 'search engines must be able to fetch render-critical assets');
  assert.equal(rule.allow, '/');
});
