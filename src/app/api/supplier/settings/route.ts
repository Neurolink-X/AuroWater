import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const settingsSchema = z.object({
  price_per_can: z.number().min(1).max(1000).optional(),
  upi_id: z.string().min(3).optional(),
  bank_account: z.string().min(6).optional(),
  ifsc: z.string().min(6).optional(),
  auto_accept: z.boolean().optional(),
  qr_code_url: z.string().url().optional(),
  base_lat: z.number().min(-90).max(90).nullable().optional(),
  base_lng: z.number().min(-180).max(180).nullable().optional(),
  zone_radius_km: z.number().int().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('supplier_settings')
    .select('*')
    .eq('user_id', auth.ctx.profile.id)
    .maybeSingle();
  if (error) return jsonErr(error.message, 502);

  return jsonOk(data ?? null);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { data, error } = await auth.ctx.supabase
    .from('supplier_settings')
    .upsert(
      { user_id: auth.ctx.profile.id, ...parsed.data },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();
  if (error) return jsonErr(error.message, 502);
  return jsonOk(data);
}

