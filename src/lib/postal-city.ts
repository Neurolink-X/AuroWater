/**
 * Shared, all-city postal district matching for AuroTap's India Post data.
 *
 * Postal districts are not always identical to commercial city names.
 * Only exceptions need aliases; all other cities use their normalized name.
 * Do not derive serviceability or supplier approval from this mapping.
 */
const DISTRICT_ALIASES: Readonly<Record<string, string>> = {
  kanpur: 'kanpur nagar',
  noida: 'gautam buddha nagar',
  'greater noida': 'gautam buddha nagar',
  'noida extension': 'gautam buddha nagar',
  'new delhi': 'new delhi',
};

export function normalizedPostalPlace(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, ' ').trim();
}

export function postalDistrictForCity(city: string): string {
  const normalized = normalizedPostalPlace(city);
  return DISTRICT_ALIASES[normalized] ?? normalized;
}

/** True only for a matching postal district; "Rudra Prayag" is not Prayagraj. */
export function postalDistrictMatchesCity(district: string, city: string): boolean {
  const normalized = normalizedPostalPlace(district);
  const expected = postalDistrictForCity(city);
  if (!normalized || !expected) return false;
  if (normalized === expected) return true;
  // Districts such as North Delhi and South West Delhi are distinct Delhi
  // post-office districts; all other city matching stays exact.
  return expected === 'delhi' && normalized.endsWith(' delhi');
}
