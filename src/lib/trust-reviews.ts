export type TrustReview = {
  name: string;
  city: string;
  initials: string;
  color: string; // tailwind gradient classes
  rating: number;
  text: string;
  service: string;
  date: string;
};

export const TRUST_REVIEWS: TrustReview[] = [
  {
    name: 'Priya Sharma',
    city: 'Kanpur',
    initials: 'PS',
    color: 'from-pink-400 to-rose-500',
    rating: 5,
    text: 'Water tanker arrived within 90 minutes of booking. Driver was polite and the water quality was excellent. Will definitely book again for our office.',
    service: 'Water Tanker Delivery',
    date: 'March 2026',
  },
  {
    name: 'Rajesh Kumar',
    city: 'Gorakhpur',
    initials: 'RK',
    color: 'from-blue-400 to-blue-600',
    rating: 5,
    text: 'Our RO was making a weird noise for weeks. The technician diagnosed and fixed it in 45 minutes. Very transparent about parts cost. Highly recommend.',
    service: 'RO Service & Repair',
    date: 'March 2026',
  },
  {
    name: 'Sunita Agarwal',
    city: 'Lucknow',
    initials: 'SA',
    color: 'from-purple-400 to-purple-600',
    rating: 5,
    text: 'Excellent plumbing service. Fixed 3 leaking pipes in under an hour. The price shown before booking was exactly what I paid. No surprises at all.',
    service: 'Plumbing Services',
    date: 'February 2026',
  },
  {
    name: 'Vikram Tiwari',
    city: 'Varanasi',
    initials: 'VT',
    color: 'from-orange-400 to-orange-600',
    rating: 5,
    text: 'Borewell motor was dead. AuroWater sent a specialist the same evening. Works perfectly now. The tracking feature showed exactly when he arrived.',
    service: 'Motor Pump Repair',
    date: 'March 2026',
  },
  {
    name: 'Anita Mishra',
    city: 'Prayagraj',
    initials: 'AM',
    color: 'from-teal-400 to-teal-600',
    rating: 5,
    text: 'Booked water tank cleaning for the first time. The team was professional and left the tank spotless. Great service at a fair price. Booking took 2 minutes.',
    service: 'Water Tank Cleaning',
    date: 'February 2026',
  },
  {
    name: 'Mohit Gupta',
    city: 'Delhi',
    initials: 'MG',
    color: 'from-indigo-400 to-indigo-600',
    rating: 5,
    text: 'Used AuroWater for our office water supply in Noida. Bulk pricing is very competitive and the supplier was on time every single delivery.',
    service: 'Water Tanker Delivery',
    date: 'March 2026',
  },
  {
    name: 'Kavya Singh',
    city: 'Agra',
    initials: 'KS',
    color: 'from-green-400 to-green-600',
    rating: 4,
    text: 'Very smooth booking experience. The RO technician called before arriving and fixed everything quickly. Would have given 5 stars but had to wait slightly longer than expected.',
    service: 'RO Service',
    date: 'January 2026',
  },
  {
    name: 'Deepak Yadav',
    city: 'Noida',
    initials: 'DY',
    color: 'from-yellow-500 to-orange-500',
    rating: 5,
    text: 'Finally a service that actually shows real prices upfront. No haggling, no hidden fees. The plumber fixed our bathroom leak perfectly. Saved ₹300 vs local market.',
    service: 'Plumbing Services',
    date: 'March 2026',
  },
];

