import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceClient } from '@/utils/supabase/server';

/**
 * After a supplier profile exists, create default rows in `supplier_settings` and
 * `supplier_stock` when those tables exist (service role; failures are non-fatal).
 */
export async function seedSupplierRegistrationDefaults(profileId: string): Promise<void> {
  let admin: SupabaseClient;
  try {
    admin = createServiceClient();
  } catch {
    return;
  }

  const settingsRow: Record<string, string | number | boolean> = {
    user_id: profileId,
    is_online: false,
    price_per_can: 12,
    service_radius: 5,
  };

  const { error: e1 } = await admin.from('supplier_settings').insert(settingsRow);
  if (e1 && (e1 as { code?: string }).code !== '23505') {
    console.warn('[AuroWater] supplier_settings seed skipped:', e1.message);
  }

  const stockRow: Record<string, string | number> = {
    supplier_id: profileId,
    cans_available: 0,
  };

  const { error: e2 } = await admin.from('supplier_stock').insert(stockRow);
  if (e2 && (e2 as { code?: string }).code !== '23505') {
    console.warn('[AuroWater] supplier_stock seed skipped:', e2.message);
  }
}
