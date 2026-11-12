import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/utils/supabase/server';
import type { GuidePost } from '@/lib/blog/posts';
import autoGuides from '@/data/auto-guides.json';

/** Public-only read. Drafts, embargoed dates, and private author information never leave the server. */
export const publishedManagedGuides = unstable_cache(async (): Promise<GuidePost[]> => {
  try {
    const { data, error } = await createServiceClient().from('blog_posts')
      .select('slug,title,description,category,cover_image,sections,publish_at,updated_at')
      .eq('status','published')
      .lte('publish_at',new Date().toISOString())
      .order('publish_at',{ascending:false}).limit(100);
    if (error) {
      console.error('[blog/public] read failed', { code: error.code });
      return [];
    }
    return (data ?? []).filter((post) =>
      typeof post.slug === 'string' && typeof post.title === 'string' &&
      Array.isArray(post.sections) &&
      post.sections.every((s:unknown) => {
        if (!s || typeof s !== 'object') return false;
        const section = s as { heading?:unknown; paragraphs?:unknown };
        return typeof section.heading === 'string' &&
          Array.isArray(section.paragraphs) && section.paragraphs.every((p: unknown) => typeof p === 'string');
      })
    ).map(post => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      category: post.category,
      coverImage: post.cover_image ?? undefined,
      publishAt: post.publish_at!,
      updatedAt: post.updated_at,
      sections: post.sections as GuidePost['sections'],
    }));
  } catch {
    // Do not interrupt public reading if the new CMS schema has not been deployed.
    return [];
  }
}, ['aurotap-public-editorial-guides-v2'], { revalidate: 300, tags: ['blog-guides'] });

export async function allPublishedGuides(): Promise<GuidePost[]> {
  const [{ publishedGuides }, managed] = await Promise.all([
    import('@/lib/blog/posts'), publishedManagedGuides(),
  ]);
  const bySlug = new Map(publishedGuides().map(post => [post.slug, post]));
  // Version-controlled editorial guides win on slug collision.
  for (const post of managed) if (!bySlug.has(post.slug)) bySlug.set(post.slug,post);
  // Static scheduled editorial output is validated before it reaches public pages.
  for (const raw of autoGuides as unknown[]) {
    if (!raw || typeof raw !== 'object') continue;
    const post = raw as GuidePost;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(post.slug ?? '')) ||
        typeof post.title !== 'string' || typeof post.description !== 'string' ||
        typeof post.publishAt !== 'string' || !Number.isFinite(Date.parse(post.publishAt)) ||
        Date.parse(post.publishAt) > Date.now() || !Array.isArray(post.sections) ||
        !post.sections.length || !post.sections.every(section => typeof section.heading === 'string' &&
          Array.isArray(section.paragraphs) && section.paragraphs.every((p: unknown) => typeof p === 'string'))) continue;
    if (!bySlug.has(post.slug)) bySlug.set(post.slug,post);
  }
  return [...bySlug.values()].sort((a,b)=>Date.parse(b.publishAt)-Date.parse(a.publishAt));
}

export async function findPublishedGuide(slug:string):Promise<GuidePost|undefined> {
  const listed = (await allPublishedGuides()).find(post=>post.slug===slug);
  if (listed || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return listed;
  // Listing is bounded; older published URLs must keep working after the first 100 posts.
  return findArchivedManagedGuide(slug);
}

const findArchivedManagedGuide = unstable_cache(async (slug: string): Promise<GuidePost | undefined> => {
  try {
  const { data, error } = await createServiceClient().from('blog_posts')
    .select('slug,title,description,category,cover_image,sections,publish_at,updated_at')
    .eq('slug', slug).eq('status', 'published').lte('publish_at', new Date().toISOString()).maybeSingle();
  if (error || !data || !Array.isArray(data.sections) || !data.sections.every((section: unknown) => {
    if (!section || typeof section !== 'object') return false;
    const value = section as { heading?: unknown; paragraphs?: unknown };
    return typeof value.heading === 'string' && Array.isArray(value.paragraphs) && value.paragraphs.every(p => typeof p === 'string');
  })) return undefined;
  return { slug: data.slug, title: data.title, description: data.description, category: data.category,
    coverImage: data.cover_image ?? undefined, publishAt: data.publish_at!, updatedAt: data.updated_at,
    sections: data.sections as GuidePost['sections'] };
  } catch {
    console.error('[blog/public] archived article lookup failed');
    return undefined;
  }
}, ['aurotap-archived-editorial-guide-v1'], { revalidate: 300, tags: ['blog-guides'] });
