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


/**
 * A repeat order can exclusively target a supplier ONLY after that supplier
 * passed the normal coverage, city, radius, verification, workload and stock
 * prerequisites. Historical delivery/affinity is never an authorization grant.
 *
 * Customer-confirmed choice is stronger than the most recent successful
 * delivery. A referral is not automatically an exclusive preference.
 */
export function selectRepeatSupplierId<T extends SupplierCandidate>(
  eligible: readonly T[],
  customerChosenSupplierId: string | null,
  lastCompletedSupplierId: string | null,
): string | null {
  const valid = new Set(eligible.map(x => x.id));
  for (const id of [customerChosenSupplierId, lastCompletedSupplierId]) {
    if (id && valid.has(id)) return id;
  }
  return null;
}

/** Preserve normal ranking for fallback but always offer a repeat order first. */
export function prioritizeRepeatSupplier<T extends SupplierCandidate>(
  ranked: readonly T[], repeatSupplierId: string | null,
): T[] {
  if (!repeatSupplierId) return [...ranked];
  const chosen = ranked.find(candidate => candidate.id === repeatSupplierId);
  return chosen ? [chosen, ...ranked.filter(candidate => candidate.id !== repeatSupplierId)] : [...ranked];
}

/**
 * Initial parallel-offer wave is EXCLUSIVE to the repeat supplier. After
 * rejection/expiry, the next wave may reach up to three other eligible
 * suppliers. Prior offers must never be silently duplicated.
 */
export function chooseOfferWave<T extends SupplierCandidate>(
  ranked: readonly T[],
  repeatSupplierId: string | null,
  previouslyOfferedIds: ReadonlySet<string>,
  maxFanout = 3,
): T[] {
  const remaining = ranked.filter(candidate => !previouslyOfferedIds.has(candidate.id));
  if (repeatSupplierId) {
    const repeat = remaining.find(candidate => candidate.id === repeatSupplierId);
    if (repeat) return [repeat];
  }
  return remaining.slice(0, Math.max(1, Math.min(3, Math.floor(maxFanout) || 3)));
}
