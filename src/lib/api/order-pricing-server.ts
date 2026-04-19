/** Recompute GST-inclusive total from components (₹ rounded). */
export function computeExpectedTotal(
  base: number,
  convenience: number,
  emergency: number,
  gstRate: number
): { gst: number; total: number } {
  const sub = Math.max(0, base) + Math.max(0, convenience) + Math.max(0, emergency);
  const gst = Math.round(sub * gstRate);
  const total = sub + gst;
  return { gst, total };
}

/** Returns true if client total matches server expectation within `tol` rupees. */
export function totalsMatch(
  clientTotal: number,
  base: number,
  convenience: number,
  emergency: number,
  gstRate: number,
  tol = 2
): boolean {
  const { total } = computeExpectedTotal(base, convenience, emergency, gstRate);
  return Math.abs(clientTotal - total) <= tol;
}

/** Parse gst_rate from flat settings map (`18` or `0.18`). */
export function pickGstRateFromFlat(map: Record<string, string>): number {
  const g = map.gst_rate;
  if (g === undefined) return 0.18;
  const n = Number(g);
  if (!Number.isFinite(n)) return 0.18;
  return n > 1 ? n / 100 : n;
}
