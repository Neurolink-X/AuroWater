import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const PRICING_KEY = 'pricing_rules';

const ruleSchema = z.object({
  id: z.string().optional(),
  service_type_id: z.number().int(),
  zone_id: z.string().nullable().optional(),
  base_price: z.number().nonnegative(),
  distance_multiplier: z.number().optional(),
  tax_percentage: z.number().optional(),
  min_order_value: z.number().optional(),
  emergency_charge: z.number().optional(),
});

type PricingRule = z.infer<typeof ruleSchema> & { id: string };

async function loadRules(sb: ReturnType<typeof import('@/lib/db/supabase').createSupabaseUserClient>): Promise<PricingRule[]> {
  const { data, error } = await sb.from('settings').select('value').eq('key', PRICING_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) return [];
  try {
    const parsed = JSON.parse(data.value) as unknown;
    return Array.isArray(parsed) ? (parsed as PricingRule[]) : [];
  } catch {
    return [];
  }
}

async function saveRules(rules: PricingRule[]): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin.from('settings').upsert(
    { key: PRICING_KEY, value: JSON.stringify(rules), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw new Error(error.message);
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  try {
    const rules = await loadRules(auth.ctx.supabase);
    const typeIds = [...new Set(rules.map((r) => r.service_type_id))];
    let names: Record<number, string> = {};
    if (typeIds.length) {
      const { data: types } = await auth.ctx.supabase
        .from('service_types')
        .select('id, name')
        .in('id', typeIds);
      names = Object.fromEntries((types ?? []).map((t) => [t.id as number, t.name as string]));
    }
    const enriched = rules.map((r) => ({
      ...r,
      service_name: names[r.service_type_id] ?? null,
      zone_name: null,
    }));
    return jsonOk(enriched);
  } catch (e: unknown) {
    return jsonErr(e instanceof Error ? e.message : 'Failed to load pricing rules', 502);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = ruleSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  try {
    const rules = await loadRules(auth.ctx.supabase);
    const rule: PricingRule = {
      ...parsed.data,
      id: crypto.randomUUID(),
      distance_multiplier: parsed.data.distance_multiplier ?? 1,
      tax_percentage: parsed.data.tax_percentage ?? 0,
      min_order_value: parsed.data.min_order_value ?? 0,
      emergency_charge: parsed.data.emergency_charge ?? 0,
    };
    rules.unshift(rule);
    await saveRules(rules);
    return jsonOk(rule, 201);
  } catch (e: unknown) {
    return jsonErr(e instanceof Error ? e.message : 'Failed to create pricing rule', 502);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const body = raw as { id?: string };
  if (!body.id) return jsonErr('id is required', 400);

  try {
    const rules = await loadRules(auth.ctx.supabase);
    const idx = rules.findIndex((r) => r.id === body.id);
    if (idx < 0) return jsonErr('Pricing rule not found', 404);
    rules[idx] = { ...rules[idx], ...(raw as PricingRule) };
    await saveRules(rules);
    return jsonOk(rules[idx]);
  } catch (e: unknown) {
    return jsonErr(e instanceof Error ? e.message : 'Failed to update pricing rule', 502);
  }
}
