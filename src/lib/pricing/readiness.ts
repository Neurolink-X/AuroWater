export function pricingIsVerified(version: unknown, verifiedCity: string | null, city?: string): boolean {
  const key = city?.trim().toLowerCase() || 'global';
  return Number.isInteger(version) && Number(version) > 0 && verifiedCity === key;
}
