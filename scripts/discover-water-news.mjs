#!/usr/bin/env node
/**
 * Free discovery ONLY. External headlines are untrusted leads, NOT verified
 * facts. Review primary sources before moving into water-news-reviewed.json.
 * O(K) bounded feed parsing + O(N) dedupe; hard cap protects memory.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const output = new URL('../content/water-news-candidates.json', import.meta.url);
const feedUrl = 'https://news.google.com/rss/search?q=' +
  encodeURIComponent('(drinking water OR water quality OR RO water OR water tanker) India when:7d') +
  '&hl=en-IN&gl=IN&ceid=IN:en';
const MAX_BYTES = 450_000;
const MAX_ITEMS = 50;
const MAX_STORED = 80;
const MAX_QUEUE_BYTES = 120_000;
const MAX_AGE_MS = 14 * 86400000;
const esc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g,
    (_, n) => String.fromCodePoint(Math.min(1114111, Number(n))));
function tag(xml, name) {
  const match = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return match ? esc(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim()) : '';
}
export function parseFeed(xml, now = Date.now()) {
  const seen = new Set();
  const result = [];
  for (const item of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const title = tag(item[1], 'title').replace(/\s+/g, ' ').trim();
    const link = tag(item[1], 'link').trim();
    const date = new Date(tag(item[1], 'pubDate'));
    if (title.length < 20 || title.length > 200 || !Number.isFinite(date.getTime()) ||
      date.getTime() > now + 86400000 || now - date.getTime() > MAX_AGE_MS) continue;
    let url;
    try {
      url = new URL(link);
      if (url.protocol !== 'https:' || !['news.google.com', 'www.google.com'].includes(url.hostname)) continue;
    } catch { continue; }
    const key = title.toLocaleLowerCase('en-IN').replace(/[^a-z0-9]/g, '').slice(0,110);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ key, title, source_url: url.href, source_published_at: date.toISOString(),
      discovered_at: new Date(now).toISOString(), status: 'NEEDS_SOURCE_VERIFICATION' });
    if (result.length >= MAX_ITEMS) break;
  }
  return result;
}

async function main() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/rss+xml, application/xml' },
      redirect: 'error',
    });
    if (!response.ok || Number(response.headers.get('content-length') || 0) > MAX_BYTES)
      throw new Error('Feed inaccessible or oversized');
    // Stream with a hard input limit: content-length is not trustworthy.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Feed response has no readable stream');
    const chunks = [];
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error('Feed exceeded memory budget');
      }
      chunks.push(part.value);
    }
    const xml = new TextDecoder().decode(Buffer.concat(chunks, bytes));
    const incoming = parseFeed(xml);
    if (!incoming.length) {
      console.log('No eligible recent articles. No changes.');
      return;
    }
    let old = [];
    try {
      const { stat } = await import('node:fs/promises');
      if ((await stat(output)).size <= MAX_QUEUE_BYTES) old = JSON.parse(await readFile(output, 'utf8'));
    } catch {}
    const merged = new Map();
    // Preserve editorial status/notes on existing candidates; expire stale leads.
    for (const item of [...(Array.isArray(old) ? old : []), ...incoming]) {
      if (typeof item?.key !== 'string' || merged.has(item.key) ||
          !Number.isFinite(Date.parse(item.source_published_at)) ||
          Date.now() - Date.parse(item.source_published_at) > MAX_AGE_MS) continue;
      merged.set(item.key, item);
      if (merged.size >= MAX_STORED) break;
    }
    const next = JSON.stringify([...merged.values()], null, 2) + '\n';
    await mkdir(new URL('../content/', import.meta.url), { recursive: true });
    if (next !== JSON.stringify(Array.isArray(old) ? old : [], null, 2) + '\n') {
      await writeFile(output, next);
      console.log('Updated candidate review queue:', merged.size);
    } else console.log('Review queue unchanged.');
  } finally { clearTimeout(timer); }
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  main().catch(err => { console.error('News discovery failed:', err.message); process.exitCode = 1; });
}
