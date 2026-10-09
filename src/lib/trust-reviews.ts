/**
 * Public testimonials must come from real, consented customer reviews tied to
 * completed orders. Keep this empty until verified review records are connected.
 */
export type TrustReview = {
  name: string;
  city: string;
  initials: string;
  color: string;
  rating: number;
  text: string;
  service: string;
  date: string;
};

export const TRUST_REVIEWS: TrustReview[] = [];
