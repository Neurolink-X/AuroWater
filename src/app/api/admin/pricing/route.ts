import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

type PriceBook = {
  water_normal: number; water_chilled: number; water_subscription: number;
  bulk_can_price: number; bulk_threshold: number; services: Record<string, number>;
  convenience_fee: number; emergency_surcharge: number; gst_rate: number;
};
type Config = PriceBook & { city_overrides?: Record<string, PriceBook> };
const money = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function validate(raw: unknown): { config?: Config; error?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Pricing config must be an object.' };
  const v = raw as Record<string, unknown>;
  for (const [key, label, minimum] of [['water_normal','Normal water',20],['water_chilled','Chilled water',25],['water_subscription','Subscription water',20],['bulk_can_price','Bulk water',20]] as const) {
    if (!money(v[key], minimum, 500)) return { error: label + ' price must be between ₹' + minimum + ' and ₹500 under the current launch pricing policy.' };
  }
  if (!Number.isInteger(v.bulk_threshold) || !money(v.bulk_threshold, 2, 200)) return { error: 'Bulk threshold must be a whole number from 2 to 200.' };
  if (!money(v.convenience_fee, 0, 500) || !money(v.emergency_surcharge, 0, 5000)) return { error: 'Fees are outside the allowed range.' };
  if (!money(v.gst_rate, 0, 1)) return { error: 'GST must be decimal-based (for example, 0.18).' };
  if (Number(v.bulk_can_price) > Number(v.water_normal)) return { error: 'Bulk price cannot exceed normal water price.' };
  if (!v.services || typeof v.services !== 'object' || Array.isArray(v.services)) return { error: 'Service prices are required.' };
  const serviceEntries: Array<[string, number]> = [];
  for (const [key, value] of Object.entries(v.services as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(key) || !money(value, 1, 100000)) return { error: 'Invalid service price: ' + key };
    serviceEntries.push([key, Math.round(value * 100) / 100]);
  }
  const services = Object.fromEntries(serviceEntries) as Record<string, number>;
  if (!serviceEntries.length) return { error: 'At least one service price is required.' };
  const cityOverrideEntries: Array<[string, PriceBook]> = [];
  if (v.city_overrides !== undefined) {
    if (!v.city_overrides || typeof v.city_overrides !== 'object' || Array.isArray(v.city_overrides)) return { error: 'City pricing overrides must be an object.' };
    for (const [rawCity, rawOverride] of Object.entries(v.city_overrides as Record<string, unknown>)) {
      const city = rawCity.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!city || city.length > 60) return { error: 'Invalid city name in pricing overrides.' };
      if (!rawOverride || typeof rawOverride !== 'object' || Array.isArray(rawOverride) || 'city_overrides' in (rawOverride as Record<string, unknown>)) return { error: `Nested city overrides are not allowed for ${rawCity}.` };
      const checked = validate(rawOverride);
      if (!checked.config) return { error: `Invalid pricing for ${rawCity}: ${checked.error ?? 'check all fields'}` };
      const cleanOverride = Object.fromEntries(Object.entries(checked.config).filter(([key]) => key !== 'city_overrides')) as PriceBook;
      cityOverrideEntries.push([city, cleanOverride]);
    }
  }
  return { config: {
    water_normal: Math.round(Number(v.water_normal) * 100) / 100,
    water_chilled: Math.round(Number(v.water_chilled) * 100) / 100,
    water_subscription: Math.round(Number(v.water_subscription) * 100) / 100,
    bulk_can_price: Math.round(Number(v.bulk_can_price) * 100) / 100,
    bulk_threshold: Number(v.bulk_threshold), services,
    convenience_fee: Math.round(Number(v.convenience_fee) * 100) / 100,
    emergency_surcharge: Math.round(Number(v.emergency_surcharge) * 100) / 100,
    gst_rate: Number(v.gst_rate),
    ...(cityOverrideEntries.length ? { city_overrides: Object.fromEntries(cityOverrideEntries) as Record<string, PriceBook> } : {}),
  } };
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);
  const { data, error } = await auth.ctx.supabase.from('pricing_versions')
    .select('id, version, effective_from, reason, config, created_at, created_by')
    .order('version', { ascending: false }).limit(100);
  if (error) {
    console.error('[admin/pricing] load failed', error);
    return jsonErr(error.code === '42P01' || error.code === 'PGRST205'
      ? 'Apply sql/027_versioned_pricing_rules.sql before using versioned pricing.'
      : 'Unable to load pricing versions.', error.code === '42P01' || error.code === 'PGRST205' ? 503 : 502);
  }
  const versions = (data ?? []).map((row) => ({ ...row, currently_effective: Date.parse(row.effective_from) <= Date.now() }));
  return jsonOk({ versions, current: versions.find((row) => row.currently_effective) ?? null });
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await req.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return jsonErr('Invalid JSON body.', 400);
    body = raw as Record<string, unknown>;
  } catch { return jsonErr('Invalid JSON body.', 400); }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 3 || reason.length > 500) return jsonErr('Reason must be 3–500 characters.', 400);
  const result = validate(body.config);
  if (!result.config) return jsonErr(result.error ?? 'Invalid pricing configuration.', 400);
  const date = typeof body.effective_from === 'string' ? new Date(body.effective_from) : new Date();
  if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 60_000) return jsonErr('Effective date must be now or in the future.', 400);

  const { data, error } = await auth.ctx.supabase.rpc('publish_pricing_version', {
    p_effective_from: date.toISOString(),
    p_reason: reason,
    p_config: result.config,
  });
  const published = Array.isArray(data) ? data[0] : data;
  if (error || !published) {
    console.error('[admin/pricing] atomic publish failed', error);
    const code = String(error?.code ?? '');
    return jsonErr(code === '42501' ? 'Administrator access required.'
      : code === '23505' ? 'A concurrent pricing publish occurred. Refresh history and try again.'
      : 'Pricing could not be published. The database transaction was rolled back.', code === '42501' ? 403 : 409);
  }
  return jsonOk(published, 201);
}
