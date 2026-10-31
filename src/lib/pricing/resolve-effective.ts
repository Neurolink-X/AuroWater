/**
 * Effective pricing resolution shared by public display and server checkout.
 *
 * Published price books are immutable. A city override is a partial patch,
 * not a replacement for global service prices. This resolver deliberately
 * never inserts legacy defaults: missing or invalid published fields must be
 * detected before a new order is accepted.
 */
export type PublishedPriceBook = Record<string, unknown>;
export type EffectivePriceBook = PublishedPriceBook & {
  services: Record<string, unknown>;
  city_key: string;
};

export function normalizePricingCity(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  const aliases: Record<string, string> = {
    gurgaon: 'gurugram',
    'new-delhi': 'delhi',
  };
  const normalized = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return aliases[normalized] ?? normalized;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveEffectivePriceBook(
  published: unknown,
  city: unknown,
): EffectivePriceBook | null {
  if (!isPlainRecord(published)) return null;
  const cityKey = normalizePricingCity(city);
  const overrides = isPlainRecord(published.city_overrides)
    ? published.city_overrides
    : {};
  const override = cityKey && Object.hasOwn(overrides, cityKey) && isPlainRecord(overrides[cityKey])
    ? overrides[cityKey]
    : null;
  const globalServices = isPlainRecord(published.services)
    ? published.services
    : {};
  const cityServices = override && isPlainRecord(override.services)
    ? override.services
    : {};
  return {
    ...published,
    ...(override ?? {}),
    services: { ...globalServices, ...cityServices },
    city_key: override ? cityKey : 'global',
  };
}

export type PricingIssue = { field: string; reason: string };
export function validateEffectivePriceBook(book: EffectivePriceBook): PricingIssue[] {
  const issues: PricingIssue[] = [];
  const numericFields: Record<string, { min: number; max: number; integer?: boolean }> = {
    water_normal: { min: 20, max: 10000 },
    water_chilled: { min: 25, max: 10000 },
    water_subscription: { min: 20, max: 10000 },
    bulk_can_price: { min: 20, max: 10000 },
    bulk_threshold: { min: 2, max: 200, integer: true },
    convenience_fee: { min: 0, max: 100000 },
    delivery_fee: { min: 0, max: 100000 },
    emergency_surcharge: { min: 0, max: 100000 },
    surge_charge: { min: 0, max: 100000 },
    gst_rate: { min: 0, max: 1 },
  };
  for (const [field, constraint] of Object.entries(numericFields)) {
    const value = book[field];
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < constraint.min ||
      value > constraint.max ||
      (constraint.integer && !Number.isSafeInteger(value))
    ) issues.push({ field, reason: 'Missing or invalid published value' });
  }
  if (typeof book.bulk_can_price === 'number' && typeof book.water_normal === 'number'
    && book.bulk_can_price > book.water_normal) {
    issues.push({ field: 'bulk_can_price', reason: 'Bulk price cannot exceed normal price' });
  }
  if (!isPlainRecord(book.services)) {
    issues.push({ field: 'services', reason: 'Published service price map is missing' });
    return issues;
  }
  const requiredServices = [
    'water_tanker', 'ro_service', 'plumbing', 'plumbing_mistri',
    'borewell', 'motor_pump', 'tank_cleaning',
    'ro_service_filter_change', 'ro_service_amc', 'ro_service_new_installation',
    'plumbing_drainage', 'plumbing_new_fitting',
    'water_tanker_1000', 'water_tanker_2000', 'water_tanker_custom',
    'borewell_drilling_4_5', 'borewell_drilling_6',
    'borewell_drilling_6_5', 'borewell_drilling_8',
  ];
  for (const key of requiredServices) {
    if (!(key in book.services)) issues.push({ field: `services.${key}`, reason: 'Required published service rate missing' });
  }
  for (const [key, value] of Object.entries(book.services)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000 || Math.abs(Math.round(value * 100) - value * 100) > 1e-7) {
      issues.push({ field: `services.${key}`, reason: 'Invalid published service rate' });
    }
  }
  return issues;
}
