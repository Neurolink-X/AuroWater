/**
 * Supplier-selected service radius is an absolute dispatch limit.
 * Zone approval is checked separately; radius never grants coverage.
 */
export function withinSupplierRadius(distanceKm: number, selectedRadiusKm: number): boolean {
  return Number.isFinite(distanceKm) &&
    Number.isFinite(selectedRadiusKm) &&
    distanceKm >= 0 &&
    selectedRadiusKm > 0 &&
    distanceKm <= selectedRadiusKm;
}
