import type { ServiceKey } from '@/hooks/useSettings';

export type PricingInput = {
  serviceKey: ServiceKey;
  basePrice: number;
  convenienceFee: number;
  gstRate: number; // 0..1
  emergencySurcharge: number;
  emergency: boolean;
  technicianCommissionRate: number; // 0..1
  supplierCommissionRate: number; // 0..1
};

export type PriceBreakdown = {
  serviceKey: ServiceKey;
  base: number;
  convenienceFee: number;
  gstRate: number;
  gstAmount: number;
  emergencySurcharge: number;
  total: number;
  technicianEarnings: number;
  supplierEarnings: number;
  platformRevenue: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function calculateOrderTotal(input: PricingInput): PriceBreakdown {
  const base = Math.max(0, round2(input.basePrice));
  const convenienceFee = Math.max(0, round2(input.convenienceFee));
  const gstRate = clamp01(input.gstRate);
  const emergencySurcharge = input.emergency ? Math.max(0, round2(input.emergencySurcharge)) : 0;

  const taxable = round2(base + convenienceFee);
  const gstAmount = round2(taxable * gstRate);
  const total = round2(base + convenienceFee + gstAmount + emergencySurcharge);

  let techRate = clamp01(input.technicianCommissionRate);
  let supplierRate = clamp01(input.supplierCommissionRate);
  if (techRate + supplierRate > 1) {
    const sum = techRate + supplierRate;
    techRate = techRate / sum;
    supplierRate = supplierRate / sum;
  }

  // Keep revenue integrity by deriving the final leg from the residual.
  const technicianEarnings = round2(total * techRate);
  const supplierEarnings = round2(total * supplierRate);
  const platformRevenue = round2(total - technicianEarnings - supplierEarnings);

  return {
    serviceKey: input.serviceKey,
    base,
    convenienceFee,
    gstRate,
    gstAmount,
    emergencySurcharge,
    total,
    technicianEarnings,
    supplierEarnings,
    platformRevenue: round2(Math.max(0, platformRevenue)),
  };
}

export function validateRevenueIntegrity(row: PriceBreakdown): boolean {
  const sum = round2(row.technicianEarnings + row.supplierEarnings + row.platformRevenue);
  return round2(sum) === round2(row.total);
}

