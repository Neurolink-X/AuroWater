import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({ code: z.string().trim().min(1).max(32) }).strict();

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const userId = auth.ctx.profile.id;
  const admin = createServiceClient();
  const [profileResult, inviteResult, rewardResult] = await Promise.all([
    admin.from('profiles').select('referral_code, referred_by').eq('id', userId).maybeSingle(),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', userId).eq('role', 'customer'),
    admin.from('referral_reward_events')
      .select('id, reward_type, reward_status, qualifying_order_id, created_at, redeemed_at')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (profileResult.error) {
    console.error('[customer/referrals] profile lookup failed', profileResult.error.message);
    return jsonErr('Could not load your referral profile right now.', 503);
  }
  if (rewardResult.error && !['42P01', 'PGRST205'].includes(String((rewardResult.error as { code?: string }).code ?? ''))) {
    console.error('[customer/referrals] reward lookup failed', rewardResult.error.message);
    return jsonErr('Could not load referral rewards right now.', 503);
  }

  const rewards = rewardResult.error ? [] : rewardResult.data ?? [];
  const qualifiedCount = rewards.filter((row) => row.reward_type === 'discount_25').length;
  return jsonOk({
    referral_code: profileResult.data?.referral_code ?? null,
    has_referred_by: Boolean(profileResult.data?.referred_by),
    invited_count: inviteResult.count ?? 0,
    qualified_count: qualifiedCount,
    next_free_can_at: qualifiedCount > 0 && qualifiedCount % 5 === 0 ? 5 : 5 - (qualifiedCount % 5),
    rewards,
    rewards_available: rewards.filter((row) => row.reward_status === 'available').length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await req.json();
    const result = bodySchema.safeParse(json);
    if (!result.success) return jsonErr('Enter a valid referral code.', 400);
    parsed = result.data;
  } catch {
    return jsonErr('Invalid request body.', 400);
  }

  const { data, error } = await auth.ctx.supabase.rpc('apply_referral_code', {
    p_code: parsed.code.toUpperCase(),
  });
  if (error) {
    const message = error.message || 'Could not apply this referral code.';
    const safeMessage = /already|invalid|first booking|before your first|unavailable|different/i.test(message)
      ? message
      : 'Referral code could not be applied. Please try again or contact support.';
    return jsonErr(safeMessage, error.code === '42501' ? 403 : 400);
  }

  return jsonOk({ applied: true, referrer_id: data, message: 'Referral code applied successfully.' });
}
