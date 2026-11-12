import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { NEWS_STATUS_SLUG, WEEKLY_NEWS_CATEGORY, nextNewsCheck, weekSlug } from '@/lib/blog/weekly-news';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);
  const db = createServiceClient();
  const [state, latest] = await Promise.all([
    db.from('blog_posts').select('sections,updated_at').eq('slug', NEWS_STATUS_SLUG).maybeSingle(),
    db.from('blog_posts').select('slug,publish_at').eq('category', WEEKLY_NEWS_CATEGORY).eq('status', 'published')
      .lte('publish_at', new Date().toISOString()).order('publish_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (state.error || latest.error) return jsonErr('Unable to read weekly publishing status.', 503);
  let lastRun: unknown = null;
  try {
    const parsed: unknown = JSON.parse(state.data?.sections?.[0]?.paragraphs?.[0] ?? 'null');
    if (parsed && typeof parsed === 'object') {
      const run = parsed as Record<string, unknown>;
      if (typeof run.outcome === 'string' && ['published', 'already_published', 'failed'].includes(run.outcome) &&
          typeof run.reason === 'string' && run.reason.length <= 400 &&
          typeof run.attemptedAt === 'string' && Number.isFinite(Date.parse(run.attemptedAt))) {
        lastRun = { outcome: run.outcome, reason: run.reason, attemptedAt: run.attemptedAt };
      }
    }
  } catch { /* Invalid private status never leaks content. */ }
  return jsonOk({
    enabled: process.env.VERCEL_ENV === 'production' && process.env.AUTO_BLOG_PUBLISH_ENABLED !== 'false' && Boolean(process.env.CRON_SECRET),
    schedule: 'Sunday around 08:43 IST; daily recovery checks until this week is published',
    nextCheckAt: nextNewsCheck(), currentWeekSlug: weekSlug(), lastPublished: latest.data ?? null, lastRun,
  });
}
