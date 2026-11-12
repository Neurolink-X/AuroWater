import type { SupabaseClient } from '@supabase/supabase-js';
import { NEWS_STATUS_SLUG, WEEKLY_NEWS_CATEGORY, buildWeeklyPost, loadNewsLeads, weekSlug } from './weekly-news';

export type NewsRun = { outcome: 'published' | 'already_published'; slug: string };

/** A unique week slug is the database claim: concurrent invocations cannot overwrite a post. */
export async function publishWeeklyNews(db: Pick<SupabaseClient, 'from'>, now = new Date(), load = loadNewsLeads): Promise<NewsRun> {
  const slug = weekSlug(now);
  const existing = await db.from('blog_posts').select('slug,status').eq('slug', slug).maybeSingle();
  if (existing.error) throw new Error('Cannot check weekly publishing state');
  if (existing.data?.status === 'published') return { outcome: 'already_published', slug };
  // Never overwrite a draft that an editor intentionally kept private.
  if (existing.data) throw new Error('This week has an editorial draft; review it before automated publishing');
  const recent = await db.from('blog_posts').select('sections').eq('category', WEEKLY_NEWS_CATEGORY)
    .eq('status', 'published').order('publish_at', { ascending: false }).limit(8);
  if (recent.error) throw new Error('Cannot check recently published sources');
  const sourceLinks = (recent.data ?? []).flatMap(row => {
    const sections = row.sections as { paragraphs?: unknown[] }[];
    return Array.isArray(sections) ? sections.flatMap(section => Array.isArray(section.paragraphs)
      ? section.paragraphs.filter((value): value is string => typeof value === 'string' && value.startsWith('Source: ')).map(value => value.slice(8)) : []) : [];
  });
  const post = buildWeeklyPost(await load(now), now, sourceLinks);
  if (!post) throw new Error('No fresh eligible water news; daily recovery will retry');
  const inserted = await db.from('blog_posts').upsert(post, { onConflict: 'slug', ignoreDuplicates: true }).select('slug,status');
  if (inserted.error) throw new Error('Weekly article could not be saved');
  // A competing editor may have saved a draft between our read and insert.
  if (!inserted.data?.length) {
    const winner = await db.from('blog_posts').select('status').eq('slug', slug).maybeSingle();
    if (winner.error || winner.data?.status !== 'published') throw new Error('Weekly article is held as a draft; no automatic overwrite');
    return { outcome: 'already_published', slug };
  }
  return { outcome: 'published', slug };
}

/** Durable operational state is a private draft, never public or part of the editor's post list. */
export async function recordNewsRun(db: Pick<SupabaseClient, 'from'>, outcome: string, reason: string, now = new Date()): Promise<void> {
  const stamp = now.toISOString();
  const state = await db.from('blog_posts').upsert({
    slug: NEWS_STATUS_SLUG, title: 'Weekly water news automation status',
    description: `Last automation result: ${reason}`.slice(0, 400),
    category: 'Automation status', status: 'draft', publish_at: null, updated_at: stamp,
    sections: [{ heading: 'Last run', paragraphs: [JSON.stringify({ outcome, reason, attemptedAt: stamp, weekSlug: weekSlug(now) })] }],
  }, { onConflict: 'slug' });
  if (state.error) throw new Error('Cannot record weekly publishing status');
}
