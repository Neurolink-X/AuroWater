import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const section = z.object({
  heading: z.string().trim().min(3).max(160),
  paragraphs: z.array(z.string().trim().min(20).max(4000)).min(1).max(12),
}).strict();

const postInput = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(5).max(120),
  title: z.string().trim().min(12).max(180),
  description: z.string().trim().min(30).max(400),
  category: z.string().trim().min(2).max(80),
  cover_image: z.string().max(500).refine(v => v.startsWith('/images/') || (v.startsWith('https://') && v.includes('.supabase.co/storage/v1/object/public/blog-images/covers/') && /\.(jpg|jpeg|png|webp)$/.test(v)), 'Invalid cover image path').nullable(),
  sections: z.array(section).min(1).max(24),
  status: z.enum(['draft','published']),
  publish_at: z.string().datetime({ offset: true }).nullable(),
}).strict();

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden',403);
  const { data, error } = await createServiceClient().from('blog_posts')
    .select('id,slug,title,description,category,cover_image,sections,status,publish_at,created_at,updated_at')
    .order('updated_at',{ ascending: false }).limit(100);
  if (error) {
    console.error('[admin/blog] list failed', { code: error.code });
    return jsonErr('Could not load editorial posts.',503);
  }
  return jsonOk(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden',403);
  const body = await req.json().catch(() => null);
  const parsed = postInput.safeParse(body);
  if (!parsed.success) return jsonErr('Invalid article. Check title, slug, summary, paragraphs and date.',422);
  const input = parsed.data;
  if (input.status === 'published' && (!input.publish_at || !Number.isFinite(Date.parse(input.publish_at)))) {
    return jsonErr('Publishing requires an explicit valid publish date.',422);
  }
  const { data, error } = await createServiceClient().from('blog_posts')
    .insert({ ...input, author_id: auth.ctx.user.id }).select('id,slug,status').single();
  if (error) {
    if (error.code === '23505') return jsonErr('This article URL slug already exists.',409);
    console.error('[admin/blog] create failed', { code:error.code });
    return jsonErr('Unable to save article.',503);
  }
  return jsonOk(data,201);
}
