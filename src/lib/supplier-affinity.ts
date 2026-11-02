/** Supplier relationship priority: no monetary referral rewards.
 * Only a customer-confirmed, active relationship can influence eligible dispatch.
 * Eligibility, atomic stock reservation and customer choice remain authoritative.
 */
export type SupplierCandidate = { id: string; coverageTier: number; group: number; distance: number | null; favourite: boolean; tier: number; load: number };
export type SupplierAffinity = { supplier_id: string; status: string; priority_expires_at: string; customer_confirmed_at: string | null };
export function preferredSupplierId(
  relationships: SupplierAffinity[],
  now = new Date()
): string | null {
  const eligible = relationships.filter(r =>
    r.status === 'active' &&
    Boolean(r.customer_confirmed_at) &&
    Number.isFinite(Date.parse(r.priority_expires_at)) &&
    Date.parse(r.priority_expires_at) > now.getTime()
  );
  eligible.sort((a,b) => Date.parse(b.priority_expires_at) - Date.parse(a.priority_expires_at) || a.supplier_id.localeCompare(b.supplier_id));
  return eligible[0]?.supplier_id ?? null;
}
export function rankSupplierCandidates<T extends SupplierCandidate>(
  candidates: readonly T[], confirmedSupplierId: string | null
): T[] {
  return [...candidates].sort((a,b) =>
    a.coverageTier - b.coverageTier ||
    // The relationship only influences suppliers who already passed serviceability checks.
    Number(b.id === confirmedSupplierId) - Number(a.id === confirmedSupplierId) ||
    a.group - b.group ||
    (a.distance ?? Infinity) - (b.distance ?? Infinity) ||
    Number(b.favourite) - Number(a.favourite) ||
    b.tier - a.tier ||
    a.load - b.load ||
    a.id.localeCompare(b.id)
  );
}
