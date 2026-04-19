/** Flat `settings` table rows → client mergeSettings()-compatible payload. */
export function rowsToSettingsPayload(
  rows: { key: string; value: string }[] | null | undefined
): Record<string, unknown> {
  if (!rows?.length) return {};

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;

  const out: Record<string, unknown> = {
    default_can_price: map.default_can_price ? Number(map.default_can_price) : undefined,
    subscription_can_price: map.subscription_can_price ? Number(map.subscription_can_price) : undefined,
    bulk_can_price: map.bulk_can_price ? Number(map.bulk_can_price) : undefined,
    bulk_threshold: map.bulk_threshold ? Number(map.bulk_threshold) : undefined,
    market_can_price: map.market_can_price ? Number(map.market_can_price) : undefined,
    convenience_fee: map.convenience_fee ? Number(map.convenience_fee) : undefined,
    emergency_surcharge: map.emergency_surcharge ? Number(map.emergency_surcharge) : undefined,
    gst_rate: map.gst_rate !== undefined ? Number(map.gst_rate) : undefined,
    bulk_commission: map.bulk_commission !== undefined ? Number(map.bulk_commission) : undefined,
    technician_commission_rate:
      map.technician_commission !== undefined ? Number(map.technician_commission) : undefined,
    supplier_commission_rate:
      map.supplier_commission !== undefined ? Number(map.supplier_commission) : undefined,
    support_email: map.support_email,
    secondary_email: map.secondary_email || null,
    phone_primary: map.phone_primary,
    phone_secondary: map.phone_secondary || null,
    office_address: map.office_address,
    working_hours: map.working_hours,
    brand_name: map.brand_name,
    whatsapp_enabled: map.whatsapp_enabled === '1' || map.whatsapp_enabled === 'true',
    platform_fee:
      map.platform_fee !== undefined && map.platform_fee !== ''
        ? Number(map.platform_fee)
        : undefined,
  };

  if (map.service_base_prices) {
    try {
      out.service_base_prices = JSON.parse(map.service_base_prices) as Record<string, number>;
    } catch {
      /* ignore */
    }
  }

  for (const [k, raw] of Object.entries(map)) {
    if (out[k] !== undefined) continue;
    const n = Number(raw);
    const looksNumeric =
      raw !== '' &&
      Number.isFinite(n) &&
      /^-?\d+(\.\d+)?$/.test(raw.trim());
    out[k] = looksNumeric ? n : raw;
  }

  return out;
}
