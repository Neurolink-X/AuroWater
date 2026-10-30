/** Editorially reviewed, version-controlled guides. No paid CMS or AI key.
 * A future publishAt date schedules release on the next ISR revalidation.
 * Never auto-publish unverified news or live pricing claims.
 */
export type GuidePost = {
  slug: string;
  title: string;
  description: string;
  publishAt: string;
  updatedAt: string;
  category: string;
  sections: ReadonlyArray<{ heading: string; paragraphs: readonly string[] }>;
};
export const GUIDE_POSTS: readonly GuidePost[] = [
  {
    slug: 'how-to-check-20-litre-water-can-delivery',
    title: 'How to check 20-litre drinking water delivery near you',
    description: 'A practical checklist for choosing a 20-litre water can delivery service and checking local coverage.',
    publishAt: '2026-10-30T00:00:00+05:30',
    updatedAt: '2026-10-30T00:00:00+05:30',
    category: 'Water delivery',
    sections: [
      { heading: 'Check your service area first', paragraphs: ['Use your actual delivery address and PIN code when checking availability. A city being listed does not guarantee delivery to every neighbourhood.'] },
      { heading: 'Compare the complete order', paragraphs: ['Check can quantity, available delivery slot, and the final checkout total before confirming. If you need chilled water, select that option explicitly.'] },
      { heading: 'Plan for delivery', paragraphs: ['Keep your phone available, provide an identifiable landmark, and check order tracking for assignment and delivery updates. Report any sealed-can or quality concern to support.'] },
    ],
  },
  {
    slug: 'when-to-book-ro-service-or-a-plumber',
    title: 'RO purifier service or plumber: which one should you book?',
    description: 'Understand when an RO technician or a plumber may be appropriate for common water problems at home.',
    publishAt: '2026-11-01T09:00:00+05:30',
    updatedAt: '2026-10-30T00:00:00+05:30',
    category: 'Home maintenance',
    sections: [
      { heading: 'Problems inside the purifier', paragraphs: ['Low purified-water flow, filter replacement, membrane concerns, and purifier maintenance usually belong with an RO service technician. Avoid opening electrical components yourself.'] },
      { heading: 'Problems in the plumbing', paragraphs: ['Leaking taps, blocked supply pipes, valve failures, and fittings outside the purifier are usually plumbing jobs. Turn off the water supply when a leak is active and it is safe to do so.'] },
      { heading: 'Describe the symptoms', paragraphs: ['Share the affected location, when the issue started, and whether the problem affects only the RO unit or other taps. The provider can confirm suitability and price before work begins.'] },
    ],
  },
] as const;

export function publishedGuides(now = new Date()): GuidePost[] {
  const timestamp = now.getTime();
  return GUIDE_POSTS.filter((post) => Date.parse(post.publishAt) <= timestamp)
    .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt));
}

export function publishedGuide(slug: string, now = new Date()): GuidePost | undefined {
  return publishedGuides(now).find((post) => post.slug === slug);
}
