import entries from '@/data/water-news-reviewed.json';

export type ReviewedNews = {
  slug: string;
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  source_published_at: string;
  reviewed_at: string;
  publish_at: string;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function valid(item: unknown): item is ReviewedNews {
  if (!item || typeof item !== 'object') return false;
  const r = item as Partial<ReviewedNews>;
  const strings = [r.slug,r.title,r.summary,r.source_name,r.source_url,r.source_published_at,r.reviewed_at,r.publish_at];
  if (!strings.every(x => typeof x === 'string')) return false;
  if (!SLUG.test(r.slug!) || r.title!.length > 180 || r.title!.length < 15 ||
    r.summary!.length < 40 || r.summary!.length > 900 || r.source_name!.length > 100) return false;
  try {
    const source = new URL(r.source_url!);
    if (source.protocol !== 'https:' || !source.hostname.includes('.')) return false;
  } catch { return false; }
  return [r.source_published_at,r.reviewed_at,r.publish_at]
    .every(date => Number.isFinite(Date.parse(date!)));
}

/** Validated, human-reviewed posts. Scheduled publication is automatic; an
 * unreviewed candidate cannot appear here or be indexed.
 */
export function publishedNews(now = new Date()): ReviewedNews[] {
  const current = now.getTime();
  const deduped = new Map<string,ReviewedNews>();
  for (const item of entries as unknown[]) {
    if (!valid(item) || Date.parse(item.publish_at) > current || deduped.has(item.slug)) continue;
    deduped.set(item.slug, item);
  }
  return [...deduped.values()].sort((a,b) => Date.parse(b.publish_at)-Date.parse(a.publish_at));
}
