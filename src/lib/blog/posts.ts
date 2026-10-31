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
  coverImage?: string; // Original reviewed editorial artwork; never imply real delivery proof.
  sections: ReadonlyArray<{ heading: string; paragraphs: readonly string[] }>;
};
export const GUIDE_POSTS: readonly GuidePost[] = [
  {
    slug: '20-litre-water-can-delivery-checklist-india',
    title: '20-Litre Water Can Delivery in India: 7 Checks Before You Order',
    description: 'A practical guide to checking your PIN code, comparing complete water-can costs, confirming delivery slots, handling sealed containers and tracking your order.',
    publishAt: '2026-10-31T09:00:00+05:30',
    updatedAt: '2026-10-31T09:00:00+05:30',
    category: 'Drinking water delivery',
    coverImage: '/images/water-delivery-checklist.svg',
    sections: [
      { heading: '1. Start with your exact delivery address', paragraphs: [
        'A valid six-digit Indian PIN code helps identify the postal area, but it does not prove that a delivery partner serves your building. Check your street, landmark, apartment and exact serviceability before placing an order.',
        'AuroTap checks address-based availability during booking. City listings and postal directories are useful references, not guaranteed delivery promises.',
      ] },
      { heading: '2. Compare the full price rather than a headline offer', paragraphs: [
        'Check the normal or chilled water option, the number of 20-litre cans, any refundable container deposit if applicable, delivery charges, and the final checkout amount before confirming. Applicable taxes or charges should be disclosed before payment.',
        'AuroTap shows server-calculated pricing at checkout. Published fees can change, so use the current checkout total rather than an older advertisement or blog article.',
      ] },
      { heading: '3. Choose a realistic delivery slot', paragraphs: [
        'Check whether your delivery address and requested time are currently supported. Keep a contact number available and add a clear landmark; apartment access rules can affect handover.',
        'If a partner or time slot is unavailable, choose another available slot instead of assuming that a visible city name guarantees dispatch.',
      ] },
      { heading: '4. Inspect containers at handover', paragraphs: [
        'Look for a clean, intact container and closure. If a can appears damaged, has an unusual smell, or shows signs of tampering, do not consume the water until the supplier resolves the concern.',
        'This is general consumer guidance, not a laboratory certification of water quality. For a quality complaint, keep the order details and contact support.',
      ] },
      { heading: '5. Know what your recurring plan actually does', paragraphs: [
        'Recurring delivery plans can reduce the effort of remembering repeat orders, but they are not the same as automatic bank payments. Read the schedule, pause/resume policy and pricing shown when creating the subscription.',
        'Eligible completed and paid AuroTap subscription renewals may earn loyalty points according to the programme rules visible in your account. Never assume points are cash or a guaranteed discount.',
      ] },
      { heading: '6. Track the real order status', paragraphs: [
        'Follow your booking from placement and assignment to delivery or completion. A status update is more useful than a generic delivery promise because dispatch depends on partner acceptance and stock.',
        'Use AuroTap order tracking and support if the delivery status seems incorrect. Do not share login codes or payment OTPs with a delivery person.',
      ] },
      { heading: '7. Save the details for repeat orders', paragraphs: [
        'A verified saved address, correct PIN code, suitable water type and clear delivery instructions reduce friction next time. Recheck availability and the displayed price on every new booking.',
        'Ready to check? Open AuroTap water delivery, enter your exact address, and review the final price before confirmation. Availability depends on real suppliers and service-area coverage.',
      ] },
    ],
  },
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
