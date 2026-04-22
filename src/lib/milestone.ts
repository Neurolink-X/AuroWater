import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceClient } from '@/utils/supabase/server';
import { MILESTONE_TIERS, type MilestoneTier } from '@/lib/milestone-constants';

type ProfileMilestoneRow = {
  completed_orders: number;
  milestone_tier: MilestoneTier;
};

function tierForCompletedOrders(completed: number): MilestoneTier {
  if (completed >= MILESTONE_TIERS.platinum.min) return 'platinum';
  if (completed >= MILESTONE_TIERS.gold.min) return 'gold';
  if (completed >= MILESTONE_TIERS.silver.min) return 'silver';
  if (completed >= MILESTONE_TIERS.bronze.min) return 'bronze';
  return 'starter';
}

function dedupKeyForMilestone(supplierId: string, tier: MilestoneTier): string {
  return `milestone_${supplierId}_${tier}`;
}

export async function checkAndUpgradeMilestone(
  supplierId: string,
  supabase: SupabaseClient
): Promise<{
  upgraded: boolean;
  newTier: MilestoneTier;
  previousTier: MilestoneTier;
}> {
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('completed_orders, milestone_tier')
    .eq('id', supplierId)
    .maybeSingle();

  if (pErr) throw new Error(pErr.message);
  if (!profile) throw new Error('Supplier profile not found');

  const row = profile as unknown as ProfileMilestoneRow;
  const completed = Number(row.completed_orders ?? 0);
  const previousTier: MilestoneTier =
    (row.milestone_tier as MilestoneTier) ?? 'starter';

  const newTier = tierForCompletedOrders(completed);
  if (newTier === previousTier) {
    return { upgraded: false, newTier, previousTier };
  }

  const meta = MILESTONE_TIERS[newTier];

  const { error: upErr } = await supabase
    .from('profiles')
    .update({ milestone_tier: newTier })
    .eq('id', supplierId);
  if (upErr) throw new Error(upErr.message);

  // Ensure supplier_settings exists; then update benefits.
  const { error: ensureErr } = await supabase
    .from('supplier_settings')
    .upsert(
      {
        user_id: supplierId,
        zone_radius_km: meta.radius,
        commission_rate: meta.commission,
      },
      { onConflict: 'user_id' }
    );
  if (ensureErr) throw new Error(ensureErr.message);

  // (Update is redundant after upsert, but kept for older PostgREST caches where upsert
  // might not apply defaults immediately. Safe and cheap.)
  const { error: ssErr } = await supabase
    .from('supplier_settings')
    .update({ zone_radius_km: meta.radius, commission_rate: meta.commission })
    .eq('user_id', supplierId);
  if (ssErr) throw new Error(ssErr.message);

  const bonus_amount = Number(meta.bonus ?? 0);
  const { error: mErr } = await supabase.from('supplier_milestones').insert({
    supplier_id: supplierId,
    tier: newTier,
    bonus_amount,
  });
  if (mErr) throw new Error(mErr.message);

  // Insert notification (service role best-effort to avoid RLS surprises).
  try {
    const sb = createServiceClient();
    const title = 'Milestone unlocked 🎉';
    const body = `🎉 You've reached ${meta.label}! Your delivery area is now ${meta.radius}km.`;
    const { error: nErr } = await sb.from('notifications').insert({
      user_id: supplierId,
      title,
      body,
      type: 'system',
      order_id: null,
      is_read: false,
      dedup_key: dedupKeyForMilestone(supplierId, newTier),
    });
    if (nErr && nErr.code !== '23505') {
      // swallow
      console.error('[milestone notification]', nErr.message);
    }
  } catch {
    // swallow
  }

  return { upgraded: true, newTier, previousTier };
}

