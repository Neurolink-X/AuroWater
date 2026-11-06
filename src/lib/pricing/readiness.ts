export function pricingIsVerified(version: unknown, verifiedCity: string | null, city?: string): boolean {
  const key = city?.trim().toLowerCase() || 'global';
  return Number.isInteger(version) && Number(version) > 0 && verifiedCity === key;
}

/**
 * A cache is suitable for immediate display only when it came from a published
 * server version, carries a sane timestamp, and predates no known local publish.
 * This does not replace authoritative checkout price validation on the server.
 */
export function usablePublishedPricingCache(
  version: unknown,
  cachedAt: number,
  publishedAt: number,
  now: number = Date.now(),
): boolean {
  return Number.isInteger(version) && Number(version) > 0 &&
    Number.isFinite(cachedAt) && cachedAt > 0 && cachedAt <= now &&
    Number.isFinite(now) &&
    !(Number.isFinite(publishedAt) && publishedAt > 0 && publishedAt >= cachedAt);
}

export function shouldRevalidatePublishedPricing(
  cachedAt: number,
  staleMs: number,
  now: number = Date.now(),
): boolean {
  return !Number.isFinite(cachedAt) || cachedAt <= 0 ||
    !Number.isFinite(now) || now < cachedAt ||
    !Number.isFinite(staleMs) || staleMs <= 0 ||
    now - cachedAt >= staleMs;
}
