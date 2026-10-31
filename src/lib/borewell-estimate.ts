/** Indicative borewell drilling estimates. Not an accepted quotation. */
export type BorewellDiameter = '4.5' | '6' | '6.5' | '8';
export type BorewellJob = 'drilling' | 'inspection' | 'repair';
export const BOREWELL_GUIDE = {
  drilling: {
    '4.5': { min: 80, max: 150 },
    '6': { min: 150, max: 250 },
    '6.5': { min: 150, max: 250 },
    '8': { min: 300, max: 500 },
  },
  casingPerFoot: { min: 200, max: 500 },
  pump: { min: 15000, max: 50000 },
  electrical: { min: 15000, max: 40000 },
  survey: { min: 3000, max: 15000 },
} as const;
export type BorewellEstimateInput = {
  job: BorewellJob;
  diameter: BorewellDiameter;
  depthFeet: number;
  ratePerFoot?: number;
  casingFeet?: number;
  casingRatePerFoot?: number;
  includePump?: boolean;
  includeElectrical?: boolean;
  includeSurvey?: boolean;
};
export type BorewellLine = { label: string; amount: number; provisional: boolean };
export function estimateBorewell(input: BorewellEstimateInput): {
  lines: BorewellLine[]; subtotal: number; indicative: true; requiresSiteQuote: true;
} {
  if (input.job !== 'drilling') return { lines: [], subtotal: 0, indicative: true, requiresSiteQuote: true };
  const depth = input.depthFeet;
  if (!Number.isInteger(depth) || depth < 50 || depth > 2000) throw new RangeError('Depth must be 50–2000 whole feet');
  const guide = BOREWELL_GUIDE.drilling[input.diameter];
  if (!guide) throw new RangeError('Unsupported borewell diameter');
  const rate = input.ratePerFoot ?? guide.min;
  if (!Number.isFinite(rate) || rate < guide.min || rate > guide.max) throw new RangeError('Rate outside indicative diameter range');
  const lines: BorewellLine[] = [{ label: `Drilling (${depth} ft × ₹${rate}/ft)`, amount: depth * rate, provisional: true }];
  if (input.casingFeet !== undefined) {
    const feet = input.casingFeet;
    if (!Number.isInteger(feet) || feet < 0 || feet > depth) throw new RangeError('Casing feet cannot exceed drilling depth');
    const casingRate = input.casingRatePerFoot ?? BOREWELL_GUIDE.casingPerFoot.min;
    if (!Number.isFinite(casingRate) || casingRate < 200 || casingRate > 500) throw new RangeError('Invalid casing rate');
    if (feet > 0) lines.push({ label: `Casing (${feet} ft × ₹${casingRate}/ft)`, amount: feet * casingRate, provisional: true });
  }
  if (input.includePump) lines.push({ label: 'Pump allowance (starting)', amount: 15000, provisional: true });
  if (input.includeElectrical) lines.push({ label: 'Electrical allowance (starting)', amount: 15000, provisional: true });
  if (input.includeSurvey) lines.push({ label: 'Survey allowance (starting)', amount: 3000, provisional: true });
  return { lines, subtotal: lines.reduce((sum, line) => sum + line.amount, 0), indicative: true, requiresSiteQuote: true };
}
