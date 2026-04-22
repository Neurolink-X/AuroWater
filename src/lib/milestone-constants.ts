export type MilestoneTier = 'starter' | 'bronze' | 'silver' | 'gold' | 'platinum';

export type MilestoneTierMeta = {
  min: number;
  radius: number;
  commission: number;
  label: string;
  bonus?: number;
};

export const MILESTONE_TIERS: Record<MilestoneTier, MilestoneTierMeta> = {
  starter:  { min: 0,   radius: 5,  commission: 8, label: 'Starter' },
  bronze:   { min: 50,  radius: 8,  commission: 7, label: 'Bronze Verified', bonus: 0 },
  silver:   { min: 150, radius: 12, commission: 6, label: 'Silver Supplier', bonus: 0 },
  gold:     { min: 300, radius: 15, commission: 5, label: 'Gold Partner', bonus: 500 },
  platinum: { min: 500, radius: 20, commission: 4, label: 'Platinum Elite', bonus: 1000 },
};

