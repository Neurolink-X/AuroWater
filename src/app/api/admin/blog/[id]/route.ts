import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const section = z.object({
  heading: z.string().trim().min(3).max(160),
  paragraphs: z.array(z.string().trim().min(20).max(4000)).min(1).max(12),
}).strict();
const patchSchema = z.object({
  title: z.string().trim().min(12).max(180),
  description: z.string().trim().min(30).max(400),
  category: z.string().trim().min(2).max(80),
  sections: z.array(section).min(1).max(24),
  status: z.enum(['draft','published']),
  publish_at: z.string().datetime({ offset:true }).nullable(),
}).strict();

export async function PUT(req:NextRequest, context:{params:Promise<{id:string}>}) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden',403);
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return jsonErr('Invalid article ID.',400);
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonErr('Invalid article fields.',422);
  if (parsed.data.status === 'published' && !parsed.data.publish_at) {
    return jsonErr('Select a publication date before publishing.',422);
  }
  const { data,error } = await createServiceClient().from('blog_posts')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id',id).select('id,slug,status').maybeSingle();
  if (error) {
    console.error('[admin/blog] update failed', { code:error.code });
    return jsonErr('Unable to update article.',503);
  }
  if (!data) return jsonErr('Article not found.',404);
  return jsonOk(data);
}
