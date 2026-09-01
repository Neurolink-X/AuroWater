// /** Flat `settings` table rows → client mergeSettings()-compatible payload. */
// export function rowsToSettingsPayload(
//   rows: { key: string; value: string }[] | null | undefined
// ): Record<string, unknown> {
//   if (!rows?.length) return {};

//   const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;

//   const out: Record<string, unknown> = {
//     default_can_price: map.default_can_price ? Number(map.default_can_price) : undefined,
//     subscription_can_price: map.subscription_can_price ? Number(map.subscription_can_price) : undefined,
//     bulk_can_price: map.bulk_can_price ? Number(map.bulk_can_price) : undefined,
//     bulk_threshold: map.bulk_threshold ? Number(map.bulk_threshold) : undefined,
//     market_can_price: map.market_can_price ? Number(map.market_can_price) : undefined,
//     convenience_fee: map.convenience_fee ? Number(map.convenience_fee) : undefined,
//     emergency_surcharge: map.emergency_surcharge ? Number(map.emergency_surcharge) : undefined,
//     gst_rate: map.gst_rate !== undefined ? Number(map.gst_rate) : undefined,
//     bulk_commission: map.bulk_commission !== undefined ? Number(map.bulk_commission) : undefined,
//     technician_commission_rate:
//       map.technician_commission !== undefined ? Number(map.technician_commission) : undefined,
//     supplier_commission_rate:
//       map.supplier_commission !== undefined ? Number(map.supplier_commission) : undefined,
//     support_email: map.support_email,
//     secondary_email: map.secondary_email || null,
//     phone_primary: map.phone_primary,
//     phone_secondary: map.phone_secondary || null,
//     office_address: map.office_address,
//     working_hours: map.working_hours,
//     brand_name: map.brand_name,
//     whatsapp_enabled: map.whatsapp_enabled === '1' || map.whatsapp_enabled === 'true',
//     platform_fee:
//       map.platform_fee !== undefined && map.platform_fee !== ''
//         ? Number(map.platform_fee)
//         : undefined,
//   };

//   if (map.service_base_prices) {
//     try {
//       out.service_base_prices = JSON.parse(map.service_base_prices) as Record<string, number>;
//     } catch {
//       /* ignore */
//     }
//   }

//   for (const [k, raw] of Object.entries(map)) {
//     if (out[k] !== undefined) continue;
//     const n = Number(raw);
//     const looksNumeric =
//       raw !== '' &&
//       Number.isFinite(n) &&
//       /^-?\d+(\.\d+)?$/.test(raw.trim());
//     out[k] = looksNumeric ? n : raw;
//   }

//   return out;
// }



/**
 * src/lib/api/settings-map.ts
 *
 * Maps public.settings JSONB rows → typed frontend payload.
 * Keys match exactly what is seeded in 003_seed_settings migration.
 *
 * IMPORTANT: Supabase returns JSONB values already parsed by the JS client.
 * Never call .trim() or string methods on `value` without checking typeof first.
 */

export type SettingsPayload = {
  // Pricing
  platform_fee_pct?: number;
  min_order_amount?: number;
  max_order_amount?: number;
  technician_base_pay?: number;
  commission_default_pct?: number;
  delivery_radius_km?: number;
  // Features
  cod_enabled?: boolean;
  razorpay_enabled?: boolean;
  maintenance_mode?: boolean;
  // App info
  app_name?: string;
  app_tagline?: string;
  support_email?: string;
  support_phone?: string;
  // Geo
  service_cities?: string[];
  founding_member_limit?: number;
  // Catch-all
  [key: string]: unknown;
};

/** Safely coerce any JSONB value to a number. Returns undefined if not numeric. */
function toNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

/** Safely coerce any JSONB value to a boolean. */
function toBoolean(val: unknown): boolean {
  return val === true || val === 1 || val === 'true' || val === '1';
}

/** Safely coerce any JSONB value to a string. */
function toStr(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  return String(val);
}

export function rowsToSettingsPayload(
  rows: { key: string; value: unknown }[] | null | undefined
): SettingsPayload {
  if (!rows?.length) return {};

  const out: SettingsPayload = {};

  for (const { key, value } of rows) {
    switch (key) {

      // ── Numbers ──────────────────────────────────────────────────────────
      case 'platform_fee_pct':
      case 'min_order_amount':
      case 'max_order_amount':
      case 'technician_base_pay':
      case 'commission_default_pct':
      case 'delivery_radius_km':
      case 'founding_member_limit':
        out[key] = toNumber(value);
        break;

      // ── Booleans ─────────────────────────────────────────────────────────
      case 'cod_enabled':
      case 'razorpay_enabled':
      case 'maintenance_mode':
        out[key] = toBoolean(value);
        break;

      // ── Arrays ───────────────────────────────────────────────────────────
      case 'service_cities':
        out[key] = Array.isArray(value) ? (value as string[]) : [];
        break;

      // ── Strings ──────────────────────────────────────────────────────────
      case 'app_name':
      case 'app_tagline':
      case 'support_email':
      case 'support_phone':
        out[key] = toStr(value);
        break;

      // ── Pass-through (unknown future keys) ───────────────────────────────
      default:
        out[key] = value;
        break;
    }
  }

  return out;
}
