import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServiceClient } from '@/utils/supabase/server';
import { publishWeeklyNews, recordNewsRun } from '@/lib/blog/weekly-news.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (data: Record<string, unknown>, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!secret || !timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`))) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }
  if (process.env.VERCEL_ENV !== 'production') return json({ ok: false, error: 'Publishing is production only' }, 403);
  if (process.env.AUTO_BLOG_PUBLISH_ENABLED === 'false') return json({ ok: true, outcome: 'disabled' });
  const db = createServiceClient();
  const now = new Date();
  try {
    const result = await publishWeeklyNews(db, now);
    // Also repair a previous attempt that committed its row but failed during cache invalidation.
    revalidateTag('blog-guides', { expire: 0 });
    revalidatePath('/blog');
    revalidatePath(`/blog/${result.slug}`);
    revalidatePath('/sitemap.xml');
    await recordNewsRun(db, result.outcome, result.slug, now);
    console.info('[blog/weekly]', { ...result, attemptedAt: now.toISOString() });
    return json({ ok: true, ...result });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'Weekly publishing failed';
    console.error('[blog/weekly]', { outcome: 'failed', reason, attemptedAt: now.toISOString() });
    try { await recordNewsRun(db, 'failed', reason, now); }
    catch { console.error('[blog/weekly] status could not be persisted'); }
    return json({ ok: false, error: 'Weekly publishing failed; inspect admin blog status. The next daily check retries.' }, 503);
  }
}
