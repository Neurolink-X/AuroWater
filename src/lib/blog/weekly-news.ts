/** Source-attributed headline briefs, never generated facts or copied articles. */
export const WEEKLY_NEWS_CATEGORY = 'Weekly water news';
export const NEWS_STATUS_SLUG = 'automation-water-news-status';
export const DAY_MS = 86_400_000;
const IST_MS = 330 * 60_000;
export const NEWS_HOSTS: Readonly<Record<string, string>> = {
  'pib.gov.in': 'Press Information Bureau',
  'thehindu.com': 'The Hindu',
  'indianexpress.com': 'The Indian Express',
  'downtoearth.org.in': 'Down To Earth',
};
export type NewsLead = { title: string; sourceName: string; sourceUrl: string; sourceDate: string };
export type WeeklyPost = {
  slug: string; title: string; description: string; category: string;
  status: 'published'; publish_at: string; updated_at: string; author_id: null; cover_image: null;
  sections: { heading: string; paragraphs: string[] }[];
};

export function weekSlug(now = new Date()): string {
  const local = new Date(now.getTime() + IST_MS);
  local.setUTCDate(local.getUTCDate() - local.getUTCDay());
  return 'water-news-week-' + local.toISOString().slice(0, 10);
}

export function nextNewsCheck(now = new Date()): string {
  const next = new Date(now);
  next.setUTCHours(3, 13, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export function cleanNewsText(value: string): string {
  return value.replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, entity => ({
      '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
    })[entity] ?? '')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, number: string) => {
      const code = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
      return code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    })
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password && !url.port && value.length <= 1800 ? url : null;
  } catch { return null; }
}
const host = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, '');
export function newsSourceLink(value: string): string | null {
  const url = httpsUrl(value);
  if (!url || !(NEWS_HOSTS[host(url)] || (url.hostname === 'news.google.com' && /^\/(?:rss\/)?articles\/[a-zA-Z0-9_-]+$/.test(url.pathname)))) return null;
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|oc$|hl$|gl$|ceid$)/.test(key)) url.searchParams.delete(key);
  return url.href;
}

/** Only trusted publisher metadata, recent dates and relevant headlines are eligible. */
export function parseNewsFeed(xml: string, now = new Date(), directPublisher?: string): NewsLead[] {
  if (Buffer.byteLength(xml) > 450_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsafe or oversized news feed');
  if (!/<rss\b/i.test(xml)) throw new Error('Invalid RSS response');
  const tag = (item: string, name: string) => cleanNewsText(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(item)?.[1] ?? '');
  const leads: NewsLead[] = [];
  let checked = 0;
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    if (++checked > 100) break;
    const item = match[1];
    const publisherUrl = /<source\b[^>]*\burl=["']([^"']+)["']/i.exec(item)?.[1] ?? directPublisher ?? '';
    const publisher = httpsUrl(cleanNewsText(publisherUrl));
    const sourceName = publisher && NEWS_HOSTS[host(publisher)];
    const sourceUrl = newsSourceLink(tag(item, 'link'));
    const date = Date.parse(tag(item, 'pubDate'));
    const title = tag(item, 'title');
    if (!sourceName || !sourceUrl || !Number.isFinite(date) || date > now.getTime() ||
      now.getTime() - date > 7 * DAY_MS || title.length < 20 || title.length > 400 ||
      !/\b(?:drinking water|clean water|potable water|water (?:supply|quality|scarcity|shortage|conservation|crisis|tanker|pollution|security|treatment|levels?)|groundwater|rainwater|jal jeevan|purification)\b/i.test(title) ||
      /\b(?:water park|water polo|coupon|celebrity|horoscope|cinnamon|lemon water)\b/i.test(title)) continue;
    const linkHost = host(new URL(sourceUrl));
    if (linkHost !== 'news.google.com' && linkHost !== host(publisher)) continue;
    // Keep only a short attributed headline, not the article body or RSS description.
    const label = /<source\b[^>]*>([\s\S]*?)<\/source>/i.exec(item)?.[1];
    const headline = label ? title.replace(new RegExp(' - ' + cleanNewsText(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '') : title;
    const words = headline.split(/\s+/);
    const shortened = words.slice(0, 20).join(' ');
    const bounded = shortened.length > 155 ? shortened.slice(0, 152).replace(/\s+\S*$/, '') + '…' : shortened + (words.length > 20 ? '…' : '');
    leads.push({ title: bounded, sourceName, sourceUrl, sourceDate: new Date(date).toISOString() });
  }
  return leads;
}

export function buildWeeklyPost(leads: NewsLead[], now = new Date(), previousSources: string[] = []): WeeklyPost | null {
  const seen = new Set(previousSources);
  const titles = new Set<string>();
  const selected = [...leads].sort((a, b) => b.sourceDate.localeCompare(a.sourceDate)).filter(lead => {
    const key = lead.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    if (seen.has(lead.sourceUrl) || titles.has(key)) return false;
    seen.add(lead.sourceUrl); titles.add(key); return true;
  }).slice(0, 3);
  if (!selected.length) return null;
  const slug = weekSlug(now);
  const stamp = now.toISOString();
  return {
    slug, title: `Water news: week of ${slug.slice(-10)}`,
    description: 'This week’s source-attributed water headlines, with publisher links and source dates. Automatically compiled; not independently fact-checked.',
    category: WEEKLY_NEWS_CATEGORY, status: 'published', publish_at: stamp, updated_at: stamp, author_id: null, cover_image: null,
    sections: [
      { heading: 'About this weekly brief', paragraphs: ['This is an automatically compiled selection of water-related headlines from selected publishers. It does not reproduce full articles or independently verify their claims. Open the original report for details, corrections and context.'] },
      ...selected.map(lead => ({ heading: lead.title, paragraphs: [
        `Publisher: ${lead.sourceName}. Source date: ${lead.sourceDate.slice(0, 10)}. This is a headline lead, not an AuroTap report or service-availability announcement.`,
        `Source: ${lead.sourceUrl}`,
      ] })),
    ],
  };
}

const query = '(drinking water OR water supply OR groundwater OR water conservation) India when:7d';
export const NEWS_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-IN&gl=IN&ceid=IN:en' },
  { url: 'https://www.thehindu.com/news/national/feeder/default.rss', publisher: 'https://www.thehindu.com' },
  { url: 'https://www.thehindu.com/news/cities/feeder/default.rss', publisher: 'https://www.thehindu.com' },
  { url: 'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss', publisher: 'https://www.thehindu.com' },
  { url: 'https://www.thehindu.com/sci-tech/energy-and-environment/feeder/default.rss', publisher: 'https://www.thehindu.com' },
];

export async function loadNewsLeads(now = new Date(), fetcher: typeof fetch = fetch): Promise<NewsLead[]> {
  const results = await Promise.allSettled(NEWS_FEEDS.map(async feed => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetcher(feed.url, { redirect: 'error', cache: 'no-store',
          signal: AbortSignal.timeout(8000), headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
        if (!response.ok || !/(?:xml|rss)/i.test(response.headers.get('content-type') ?? '') ||
          Number(response.headers.get('content-length') ?? 0) > 450_000) {
          await response.body?.cancel().catch(() => {});
          throw new Error('Feed unavailable or invalid');
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Missing feed body');
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > 450_000) throw new Error('Feed exceeds byte budget');
            chunks.push(part.value);
          }
        } finally { await reader.cancel().catch(() => {}); }
        return parseNewsFeed(Buffer.concat(chunks, bytes).toString('utf8'), now, feed.publisher);
      } catch (error) { if (attempt === 1) throw error; }
    }
    return [];
  }));
  if (results.every(result => result.status === 'rejected')) throw new Error('All news feeds are unavailable; daily recovery will retry');
  return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
}
