/**
 * Shared supplier delivery policy. Dispatch remains the final authority for
 * geographic eligibility; a larger radius never grants PIN/zone approval.
 */
export const SUPPLIER_RADIUS = {
  min: 1,
  recommendedMin: 3,
  default: 10,
  suggestReviewAbove: 25,
  selfServeMax: 30,
  max: 50,
} as const;

export function validSupplierRadius(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) &&
    value >= SUPPLIER_RADIUS.min && value <= SUPPLIER_RADIUS.max;
}

export function supplierRadiusRequiresConfirmation(radius: number): boolean {
  return radius > SUPPLIER_RADIUS.suggestReviewAbove;
}

export function supplierRadiusRequiresApproval(radius: number): boolean {
  return radius > SUPPLIER_RADIUS.selfServeMax;
}
