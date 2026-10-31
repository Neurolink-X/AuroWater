import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFeed } from '../scripts/discover-water-news.mjs';
import { checkSite } from '../scripts/check-site-health.mjs';

test('discovery validates freshness and deduplicates headlines', () => {
  const now = Date.parse('2026-10-31T07:00:00Z');
  const item = (title, link, pubDate) =>
    `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate></item>`;
  const recent = 'Fri, 30 Oct 2026 07:00:00 GMT';
  const xml = '<rss><channel>' +
    item('Important drinking water quality guidance for Indian households', 'https://news.google.com/a', recent) +
    item('Important drinking water quality guidance for Indian households', 'https://news.google.com/a', recent) +
    item('Important drinking water quality guidance for Indian households', 'http://evil.example/a', recent) +
    item('Old drinking water advisory for residents of India', 'https://news.google.com/b', 'Mon, 01 Sep 2025 00:00:00 GMT') +
    '</channel></rss>';
  const out = parseFeed(xml, now);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, 'NEEDS_SOURCE_VERIFICATION');
  assert.ok(!('summary' in out[0])); // No fabricated story/body.
});

test('health watchdog accepts healthy response and checks four routes', async () => {
  const calls = [];
  const result = await checkSite(async (url) => {
    calls.push(url.pathname);
    return { status: 200, json: async () => ({ status: 'ok', db: 'ok' }) };
  });
  assert.equal(result.status, 'healthy');
  assert.equal(calls.length, 4);
  assert.deepEqual(result.failures, []);
});

test('health watchdog rejects degraded DB payload', async () => {
  const result = await checkSite(async (url) => ({
    status: 200, json: async () => ({
      status: url.pathname === '/api/health' ? 'degraded' : 'ok', db: 'error',
    }),
  }));
  assert.equal(result.status, 'degraded');
  assert.equal(result.failures[0].path, '/api/health');
});

test('index audit and editorial workflow are non-mutating', () => {
  const idx = readFileSync(new URL('../scripts/audit-index-overlap.mjs', import.meta.url), 'utf8');
  const discovery = readFileSync(new URL('../.github/workflows/water-news-discovery.yml', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/app/blog/page.tsx', import.meta.url), 'utf8');
  const sitemap = readFileSync(new URL('../src/app/sitemap.ts', import.meta.url), 'utf8');
  assert.match(idx, /BEGIN READ ONLY/);
  assert.doesNotMatch(idx, /^\s*(?:DROP INDEX|ALTER TABLE|UPDATE public\.|DELETE FROM public\.)/im);
  assert.match(discovery, /editor-review|review queue/);
  assert.match(page, /publishedNews/);
  assert.match(sitemap, /publishedNews/);
});
