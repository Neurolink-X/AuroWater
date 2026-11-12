import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget, JsxEmit } from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const read = path => readFileSync(path, 'utf8');
function moduleFrom(path, dependencies = {}, globals = {}) {
  const exports = {};
  const code = transpileModule(read(path), { compilerOptions: {
    module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, jsx: JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: id => Object.hasOwn(dependencies, id) ? dependencies[id] : require(id),
    Buffer, URL, Response, Request, AbortSignal, console: { info() {}, error() {} }, ...globals });
  return exports;
}
const news = moduleFrom('src/lib/blog/weekly-news.ts');
const publisher = moduleFrom('src/lib/blog/weekly-news.server.ts', { './weekly-news': news });
const now = new Date('2026-11-15T03:13:00Z');
const lead = (id = 1, time = now) => ({ title: `Drinking water supply monitoring update number ${id}`,
  sourceName: 'The Hindu', sourceUrl: `https://www.thehindu.com/news/water-${id}`, sourceDate: new Date(time.getTime() - 3600000).toISOString() });
const rss = (items) => '<rss><channel>' + items.join('') + '</channel></rss>';
const item = ({ title = 'Drinking water supply monitoring update for Indian cities', url = 'https://news.google.com/rss/articles/ABC123',
  source = 'https://www.thehindu.com', date = now.toUTCString() } = {}) =>
  `<item><title>${title} - The Hindu</title><link>${url}</link><pubDate>${date}</pubDate><source url="${source}">The Hindu</source></item>`;

function memoryDb(initial = []) {
  const rows = new Map(initial.map(row => [row.slug, row]));
  const calls = [];
  let beforeWrite;
  const db = { rows, calls, failReads: false, failWrites: false, setBeforeWrite(fn) { beforeWrite = fn; },
    from(table) {
      assert.equal(table, 'blog_posts');
      let write, options, max = Infinity, sort, descending;
      const filters = [];
      const query = {
        select() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        lte(key, value) { filters.push(row => row[key] <= value); return query; },
        order(key, opts) { sort = key; descending = !opts.ascending; return query; },
        limit(value) { max = value; return query; },
        upsert(row, opts) { write = row; options = opts; return query; },
        async maybeSingle() { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
        then(resolve, reject) { return Promise.resolve().then(execute).then(resolve, reject); },
      };
      function execute() {
        calls.push({ write: Boolean(write), options, slug: write?.slug });
        if ((write && db.failWrites) || (!write && db.failReads)) return { data: null, error: { code: 'TEST_FAILURE' } };
        if (write) {
          beforeWrite?.(write, rows);
          if (options?.ignoreDuplicates && rows.has(write.slug)) return { data: [], error: null };
          rows.set(write.slug, { ...write });
          return { data: [{ ...write }], error: null };
        }
        let found = [...rows.values()].filter(row => filters.every(fn => fn(row)));
        if (sort) found = found.sort((a, b) => String(a[sort]).localeCompare(String(b[sort])) * (descending ? -1 : 1));
        return { data: found.slice(0, max), error: null };
      }
      return query;
    },
  };
  return db;
}

test('weekly key follows Sunday in IST and next check crosses midnight/year safely', () => {
  assert.equal(news.weekSlug(new Date('2026-11-14T18:29:59Z')), 'water-news-week-2026-11-08');
  assert.equal(news.weekSlug(new Date('2026-11-14T18:30:00Z')), 'water-news-week-2026-11-15');
  assert.equal(news.nextNewsCheck(now), '2026-11-16T03:13:00.000Z');
  assert.equal(news.nextNewsCheck(new Date('2026-12-31T23:00:00Z')), '2027-01-01T03:13:00.000Z');
});

test('RSS rejects untrusted publishers, mismatched links, stale/future dates and XML entities', () => {
  const entries = news.parseNewsFeed(rss([
    item(), item({ source: 'https://thehindu.com.evil.test' }), item({ url: 'https://evil.test/article' }),
    item({ source: 'https://user:pass@thehindu.com' }), item({ title: 'Celebrity water park offers discount coupon' }),
    item({ date: 'Sun, 01 Nov 2026 03:13:00 GMT' }), item({ date: 'Sun, 22 Nov 2026 03:13:00 GMT' }),
    item({ url: 'https://127.0.0.1/article' }), item({ source: 'https://constructor' }),
  ]), now);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceName, 'The Hindu');
  assert.equal(entries[0].title, 'Drinking water supply monitoring update for Indian cities');
  assert.throws(() => news.parseNewsFeed('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]>' + rss([item()]), now));
  assert.throws(() => news.parseNewsFeed('x'.repeat(450001), now));
  // eslint-disable-next-line no-script-url -- Deliberately hostile input verifies unsafe links are rejected.
  assert.equal(news.newsSourceLink('javascript:alert(1)'), null);
  assert.equal(news.newsSourceLink('https://thehindu.com.evil.test'), null);
});

test('brief is bounded and attributed, with duplicate links/headlines removed and no copied RSS body', () => {
  const leads = news.parseNewsFeed(rss([item({ title: 'Drinking water supply ' + 'extra '.repeat(35) })]), now);
  assert.ok(leads[0].title.split(/\s+/).length <= 20);
  const post = news.buildWeeklyPost([lead(1), lead(1), lead(2), lead(3), lead(4), lead(5)], now, [lead(1).sourceUrl]);
  assert.equal(post.sections.length, 4);
  assert.ok(post.sections[0].paragraphs[0].includes('does not reproduce full articles'));
  assert.ok(!JSON.stringify(post).includes('water-1"'));
  assert.equal(post.status, 'published');
  assert.equal(news.buildWeeklyPost([], now), null);
});

test('weeks keep publishing beyond the old three-topic and fifty-post caps', async () => {
  const db = memoryDb();
  for (let week = 0; week < 55; week++) {
    const date = new Date(now.getTime() + week * 7 * news.DAY_MS);
    const result = await publisher.publishWeeklyNews(db, date, async () => [lead(week + 1, date)]);
    assert.equal(result.outcome, 'published');
  }
  assert.equal(db.rows.size, 55);
});

test('concurrent duplicate runs insert once and completed weeks do not fetch feeds again', async () => {
  const db = memoryDb();
  const results = await Promise.all([1, 2].map(() => publisher.publishWeeklyNews(db, now, async () => [lead()])));
  assert.equal(db.rows.size, 1);
  assert.deepEqual(results.map(r => r.outcome).sort(), ['already_published', 'published']);
  await publisher.publishWeeklyNews(db, now, () => { throw new Error('Must not fetch again'); });
  assert.ok(db.calls.filter(call => call.write).every(call => call.options.ignoreDuplicates === true));
});

test('editorial drafts, including a concurrent draft, are never overwritten', async () => {
  const slug = news.weekSlug(now);
  const db = memoryDb([{ slug, status: 'draft' }]);
  await assert.rejects(publisher.publishWeeklyNews(db, now, async () => [lead()]), /draft/);
  assert.equal(db.rows.get(slug).status, 'draft');
  const concurrent = memoryDb();
  concurrent.setBeforeWrite((row, rows) => rows.set(row.slug, { slug: row.slug, status: 'draft' }));
  await assert.rejects(publisher.publishWeeklyNews(concurrent, now, async () => [lead()]), /draft/);
  assert.equal(concurrent.rows.get(slug).status, 'draft');
});

test('missing eligible sources and database errors fail rather than inventing an article', async () => {
  const db = memoryDb();
  await assert.rejects(publisher.publishWeeklyNews(db, now, async () => []), /No fresh eligible/);
  assert.equal(db.rows.size, 0);
  db.failReads = true;
  await assert.rejects(publisher.publishWeeklyNews(db, now, async () => [lead()]), /Cannot check/);
  db.failReads = false;
  await publisher.recordNewsRun(db, 'failed', 'No fresh eligible news', now);
  assert.equal(db.rows.get(news.NEWS_STATUS_SLUG).status, 'draft');
  assert.equal(db.rows.get(news.NEWS_STATUS_SLUG).publish_at, null);
});

test('feeds retry transient failures, fall back independently and reject oversized streamed bodies', async () => {
  let calls = 0;
  const leads = await news.loadNewsLeads(now, async url => {
    calls++;
    if (url.includes('google')) throw new Error('Temporary feed outage');
    return new Response(rss([item({ url: 'https://www.thehindu.com/news/water-3' })]), { headers: { 'content-type': 'application/rss+xml' } });
  });
  assert.equal(leads.length, news.NEWS_FEEDS.length - 1);
  assert.equal(calls, news.NEWS_FEEDS.length + 1);
  await assert.rejects(news.loadNewsLeads(now, async () => new Response('x'.repeat(450001), {
    headers: { 'content-type': 'application/xml' },
  })), /All news feeds/);
});

test('cron authentication and production gate run before any database or feed work', async () => {
  const env = { CRON_SECRET: 'test-only-secret', VERCEL_ENV: 'preview' };
  let dbCalls = 0;
  const route = moduleFrom('src/app/api/cron/blog-publish/route.ts', {
    '@/utils/supabase/server': { createServiceClient: () => { dbCalls++; return {}; } },
    '@/lib/blog/weekly-news.server': publisher, 'next/cache': {},
  }, { process: { env } });
  assert.equal((await route.GET(new Request('https://example.test/api/cron/blog-publish'))).status, 401);
  assert.equal((await route.GET(new Request('https://example.test', { headers: { Authorization: 'Bearer test-only-secret' } }))).status, 403);
  assert.equal(dbCalls, 0);
  env.VERCEL_ENV = 'production'; env.AUTO_BLOG_PUBLISH_ENABLED = 'false';
  assert.equal((await route.GET(new Request('https://example.test', { headers: { Authorization: 'Bearer test-only-secret' } }))).status, 200);
  assert.equal(dbCalls, 0);
});

test('cron repairs caches after success and persists failures for daily recovery/admin visibility', async () => {
  const events = [];
  let fail = false;
  const route = moduleFrom('src/app/api/cron/blog-publish/route.ts', {
    '@/utils/supabase/server': { createServiceClient: () => ({}) },
    '@/lib/blog/weekly-news.server': {
      publishWeeklyNews: async () => { if (fail) throw new Error('Feed outage'); return { outcome: 'already_published', slug: news.weekSlug(now) }; },
      recordNewsRun: async (_db, outcome) => { events.push(outcome); },
    },
    'next/cache': { revalidatePath: path => events.push(path), revalidateTag: tag => events.push(tag) },
  }, { process: { env: { VERCEL_ENV: 'production', CRON_SECRET: 'test-only-secret' } } });
  const request = () => new Request('https://example.test', { headers: { Authorization: 'Bearer test-only-secret' } });
  assert.equal((await route.GET(request())).status, 200);
  for (const value of ['blog-guides', '/blog', '/sitemap.xml', 'already_published']) assert.ok(events.includes(value));
  fail = true;
  const response = await route.GET(request());
  assert.equal(response.status, 503);
  assert.ok(events.includes('failed'));
});

test('older managed article URLs survive beyond the bounded list; drafts/future articles stay private', async () => {
  const rows = Array.from({ length: 102 }, (_, i) => ({ slug: `old-guide-${i}`, status: 'published',
    title: 'Original water guide', description: 'A reviewed guide for households', category: 'Water delivery',
    sections: [{ heading: 'Water', paragraphs: ['An original guidance paragraph.'] }],
    publish_at: new Date(Date.now() - (i + 1) * news.DAY_MS).toISOString(), updated_at: now.toISOString() }));
  const db = memoryDb([...rows, { ...rows[0], slug: 'private-guide', status: 'draft' },
    { ...rows[0], slug: 'future-guide', publish_at: '2099-01-01T00:00:00Z' }]);
  const managed = moduleFrom('src/lib/blog/managed-posts.ts', {
    'next/cache': { unstable_cache: fn => fn }, '@/utils/supabase/server': { createServiceClient: () => db },
    '@/lib/blog/posts': { publishedGuides: () => [] }, '@/data/auto-guides.json': { default: [] },
  });
  assert.equal((await managed.allPublishedGuides()).length, 100);
  assert.equal((await managed.findPublishedGuide('old-guide-101')).slug, 'old-guide-101');
  assert.equal(await managed.findPublishedGuide('private-guide'), undefined);
  assert.equal(await managed.findPublishedGuide('future-guide'), undefined);
});

test('admin automation status enforces authentication and role checks before reading private run state', async () => {
  let dbCalls = 0;
  let allowed = false;
  const route = moduleFrom('src/app/api/admin/blog/automation/route.ts', {
    'next/server': {}, '@/lib/blog/weekly-news': news,
    '@/utils/supabase/server': { createServiceClient: () => { dbCalls++; return memoryDb(); } },
    '@/lib/api/supabase-request': { requireSupabaseAuth: async () => ({ ok: true, ctx: {} }), requireAdmin: () => allowed },
    '@/lib/api/json-response': { jsonErr: (error, status) => Response.json({ error }, { status }), jsonOk: data => Response.json({ data }) },
  }, { process: { env: { VERCEL_ENV: 'production', CRON_SECRET: 'test-only-secret' } } });
  assert.equal((await route.GET({})).status, 403);
  assert.equal(dbCalls, 0);
  allowed = true;
  const response = await route.GET({});
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.enabled, true);
  assert.ok(!JSON.stringify(result).includes('test-only-secret'));
});

test('daily recovery schedule reaches cron without browser login; article sources are attributed and linked', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.crons.find(job => job.path === '/api/cron/blog-publish').schedule, '13 3 * * *');
  assert.ok(config.crons.some(job => job.path === '/api/cron/subscriptions'));
  const proxy = read('src/proxy.ts').split('// import { Ne')[0];
  assert.ok(proxy.includes("'/api/cron/blog-publish'"));
  const proxyModule = moduleFrom('src/proxy.ts', { 'next/server': {
    NextResponse: { next: () => new Response(null, { status: 200 }) },
  } });
  const through = proxyModule.proxy({ nextUrl: { pathname: '/api/cron/blog-publish' },
    cookies: { get() { throw new Error('Cron must not depend on browser cookies'); } } });
  assert.equal(through.status, 200);
  const article = read('src/app/blog/[slug]/page.tsx');
  assert.ok(article.includes('Automated source brief'));
  assert.ok(article.includes('newsSourceLink(paragraph.slice(8))'));
  assert.ok(article.includes('rel="noopener noreferrer"'));
  assert.ok(read('src/app/admin/blog/page.tsx').includes('Weekly publishing status'));
  assert.ok(read('src/app/api/admin/blog/route.ts').includes(".neq('slug', NEWS_STATUS_SLUG)"));
});

test('public weekly article actually renders attribution, current dates and safe original-source links', async () => {
  const post = news.buildWeeklyPost([lead()], now);
  const guide = { ...post, publishAt: post.publish_at, updatedAt: post.updated_at };
  const Link = ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children);
  const page = moduleFrom('src/app/blog/[slug]/page.tsx', {
    'next/link': { default: Link }, 'next/image': { default: () => null },
    'next/navigation': { notFound() { throw new Error('Unexpected notFound'); } },
    '@/lib/blog/posts': { GUIDE_POSTS: [] },
    '@/lib/blog/managed-posts': { findPublishedGuide: async () => guide, allPublishedGuides: async () => [guide] },
    '@/lib/env': { getSiteUrl: () => 'https://www.aurotap.in' }, '@/lib/blog/weekly-news': news,
  });
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: guide.slug }) }));
  assert.match(html, /Automated source brief/);
  assert.match(html, /not independently verify|does not reproduce/);
  assert.ok(html.includes(`href="${lead().sourceUrl}"`));
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /Publisher: The Hindu/);
});
