import type { Metadata } from 'next';
import Link from 'next/link';
import { DM_Sans, Syne } from 'next/font/google';

import PricingClient from './PricingClient';
import { BRAND, CHILLED_RO_PRICE, CITIES, FAQS, NORMAL_RO_PRICE, PAGE_PATH, SERVICE_CARDS, SITE_URL } from './pricing-shared';

// Self-hosted at build time: no render-blocking font request, no layout shift.
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm', weight: ['400', '500', '600', '700', '800'] });
const syne = Syne({ subsets: ['latin'], display: 'swap', variable: '--font-syne', weight: ['700', '800'] });

const TITLE = `Water Can Delivery Prices from ₹${NORMAL_RO_PRICE} | ${BRAND}`;
const DESCRIPTION = `20L water cans from ₹${NORMAL_RO_PRICE} (Chilled RO ₹${CHILLED_RO_PRICE}) with delivery included in ${CITIES.join(', ')}. Also book plumbers, tank cleaning, RO service and borewell work. See clear prices before you confirm.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['water can delivery price', '20 litre water can Kanpur', 'RO water delivery Lucknow', 'chilled water for events', 'plumber booking', 'water tank cleaning service', 'water tanker booking Gorakhpur'],
  alternates: { canonical: PAGE_PATH },
  openGraph: { type: 'website', siteName: BRAND, title: TITLE, description: DESCRIPTION, url: PAGE_PATH, locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

export default function PricingPage() {
  const url = SITE_URL + PAGE_PATH;
  const org = { '@type': 'Organization', name: BRAND, url: SITE_URL };
  const area = CITIES.map((c) => ({ '@type': 'City', name: c }));
  const product = (name: string, price: number, description: string) => ({
    '@type': 'Product',
    name,
    description,
    brand: { '@type': 'Brand', name: BRAND },
    offers: { '@type': 'Offer', priceCurrency: 'INR', price, url, seller: org, areaServed: area },
  });

  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: TITLE, description: DESCRIPTION, url, isPartOf: { '@type': 'WebSite', name: BRAND, url: SITE_URL }, inLanguage: 'en-IN' },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Pricing', item: url },
      ],
    },
    { '@context': 'https://schema.org', ...product('Normal RO water, 20L can', NORMAL_RO_PRICE, 'Normal RO drinking water in a 20 litre can, delivered. No separate water handling fee.') },
    { '@context': 'https://schema.org', ...product('Chilled RO water, 20L can', CHILLED_RO_PRICE, 'Chilled RO water in a 20 litre can for events and gatherings, delivered.') },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${BRAND} home water services`,
      itemListElement: SERVICE_CARDS.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'Service', name: s.name, description: s.note, provider: org, areaServed: area, url: `${SITE_URL}/book?service=${s.key}` },
      })),
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];

  return (
    <div className={`${dmSans.variable} ${syne.variable}`}>
      {ld.map((o, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(o) }} />
      ))}
      <nav aria-label="Breadcrumb" style={{ background: '#022C22', padding: '14px 24px 0', fontSize: 14, color: 'rgba(167,243,208,.8)' }}>
        <ol style={{ margin: '0 auto', maxWidth: 1160, padding: 0, listStyle: 'none', display: 'flex', gap: 8 }}>
          <li><Link href="/" style={{ color: 'inherit', fontWeight: 600 }}>Home</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" style={{ color: '#fff', fontWeight: 600 }}>Pricing</li>
        </ol>
      </nav>
      <PricingClient />
    </div>
  );
}








// 'use client';

// import React, { useMemo, useState } from 'react';
// import Image from 'next/image';
// import { useRouter } from 'next/navigation';
// import { useSettings, type PlatformSettings } from '@/hooks/useSettings';

// type PricingTab = 'individual' | 'business';
// type BillingCycle = 'weekly' | 'monthly';
// type FaqItem = { q: string; a: string };

// const WHATSAPP = 'https://wa.me/919889305803';

// // ─── Icons ────────────────────────────────────────────────────────────────────
// function IconCheck() {
//   return (
//     <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
//       <circle cx="7.5" cy="7.5" r="7" fill="#DCFCE7" />
//       <path d="M4.5 7.5L6.5 9.5L10.5 5.5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   );
// }
// function IconX() {
//   return (
//     <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
//       <circle cx="7.5" cy="7.5" r="7" fill="#F3F4F6" />
//       <path d="M5.5 9.5L9.5 5.5M9.5 9.5L5.5 5.5" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" />
//     </svg>
//   );
// }
// function IconWA() {
//   return (
//     <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
//       <path d="M20 11.5C20 15.64 16.42 19 12.2 19C10.7 19 9.3 18.61 8.1 17.9L4 19L5.1 15.2C4.45 14 4.1 12.7 4.1 11.5C4.1 7.36 7.68 4 11.9 4C16.12 4 20 7.36 20 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
//       <path d="M9.2 9.4C9.4 9.1 9.7 9 10 9C10.3 9 10.6 9.1 10.7 9.4L11.3 10.7C11.4 10.9 11.4 11.1 11.3 11.3L11 11.7C10.9 11.8 10.9 12 11 12.2C11.3 12.8 11.8 13.4 12.4 13.7C12.6 13.8 12.8 13.8 12.9 13.7L13.3 13.4C13.5 13.3 13.7 13.3 13.9 13.4L15.2 14C15.5 14.1 15.6 14.4 15.6 14.7C15.6 15 15.5 15.3 15.3 15.5C15 15.7 14.7 15.9 14.4 16C14 16.1 13.6 16.1 13.2 16C10.8 15.2 9 13.4 8.2 11C8.1 10.6 8.1 10.2 8.2 9.8C8.3 9.5 8.5 9.2 9.2 9.4Z" fill="currentColor" opacity="0.95" />
//     </svg>
//   );
// }
// function IconDroplet() {
//   return (
//     <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
//       <path d="M11 3C11 3 5 9.5 5 13.5C5 16.538 7.686 19 11 19C14.314 19 17 16.538 17 13.5C17 9.5 11 3 11 3Z" fill="url(#drop)" stroke="#0369A1" strokeWidth="1.2" />
//       <path d="M8.5 14.5C8.5 16 9.5 17 11 17" stroke="#BAE6FD" strokeWidth="1.3" strokeLinecap="round" />
//       <defs>
//         <linearGradient id="drop" x1="11" y1="3" x2="11" y2="19" gradientUnits="userSpaceOnUse">
//           <stop stopColor="#38BDF8" />
//           <stop offset="1" stopColor="#0369A1" />
//         </linearGradient>
//       </defs>
//     </svg>
//   );
// }

// // ─── Pill tag ─────────────────────────────────────────────────────────────────
// function Pill({ children, color = 'green' }: { children: React.ReactNode; color?: 'green' | 'blue' | 'amber' | 'slate' }) {
//   const map = {
//     green: { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
//     blue:  { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
//     amber: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
//     slate: { bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
//   };
//   const s = map[color];
//   return (
//     <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '3px 10px', letterSpacing: '0.04em', display: 'inline-block' }}>
//       {children}
//     </span>
//   );
// }

// // ─── Subscription card ────────────────────────────────────────────────────────
// type SubPlan = {
//   id: string;
//   name: string;
//   tagline: string;
//   badge?: string;
//   badgeColor?: 'green' | 'blue' | 'amber';
//   pricePerDelivery: number;
//   unitPrice: number | null;
//   cansPerDelivery: number | string;
//   perCan: string;
//   features: { text: string; included: boolean }[];
//   cta: string;
//   ctaVariant: 'primary' | 'outline' | 'dark';
//   highlight?: boolean;
// };

// function SubCard({ plan, frequency, onCta }: { plan: SubPlan; frequency: BillingCycle; onCta: () => void }) {
//   const [hovered, setHovered] = useState(false);
//   const price = plan.pricePerDelivery;

//   const ctaStyles: Record<string, React.CSSProperties> = {
//     primary: {
//       background: 'linear-gradient(135deg,#0D9B6C,#059652)',
//       color: '#fff',
//       border: 'none',
//       boxShadow: hovered ? '0 8px 24px rgba(13,155,108,0.45)' : '0 4px 14px rgba(13,155,108,0.3)',
//     },
//     outline: {
//       background: hovered ? 'rgba(13,155,108,0.06)' : 'transparent',
//       color: '#0D9B6C',
//       border: '2px solid #0D9B6C',
//     },
//     dark: {
//       background: hovered ? '#1E293B' : '#0F172A',
//       color: '#fff',
//       border: '1px solid rgba(255,255,255,0.12)',
//     },
//   };

//   return (
//     <article
//       onMouseEnter={() => setHovered(true)}
//       onMouseLeave={() => setHovered(false)}
//       style={{
//         position: 'relative',
//         borderRadius: 22,
//         background: plan.highlight ? 'linear-gradient(160deg,#022C22,#065F46)' : '#fff',
//         border: plan.highlight ? '2px solid #0D9B6C' : `1.5px solid ${hovered ? '#0D9B6C' : '#E5E7EB'}`,
//         boxShadow: plan.highlight
//           ? '0 20px 60px rgba(13,155,108,0.25)'
//           : hovered ? '0 12px 40px rgba(0,0,0,0.1)' : '0 2px 12px rgba(0,0,0,0.05)',
//         transform: hovered && !plan.highlight ? 'translateY(-4px)' : 'none',
//         transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
//         overflow: 'hidden',
//         display: 'flex',
//         flexDirection: 'column',
//       }}
//     >
//       {/* top bar */}
//       <div style={{
//         height: 5,
//         background: plan.highlight
//           ? 'linear-gradient(90deg,#34D399,#0D9B6C)'
//           : plan.id === 'pay-per-can' ? 'linear-gradient(90deg,#38BDF8,#0369A1)'
//           : plan.id === 'business' ? 'linear-gradient(90deg,#F59E0B,#D97706)'
//           : '#E5E7EB',
//       }} />

//       {plan.badge && (
//         <div style={{ position: 'absolute', top: 18, right: 18 }}>
//           <Pill color={plan.badgeColor ?? 'green'}>{plan.badge}</Pill>
//         </div>
//       )}

//       <div style={{ padding: '24px 26px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
//         {/* header */}
//         <div style={{ marginBottom: 18 }}>
//           <div style={{ fontSize: 18, fontWeight: 800, color: plan.highlight ? '#fff' : '#111827', letterSpacing: '-0.3px' }}>
//             {plan.name}
//           </div>
//           <div style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#6B7280', marginTop: 3, fontWeight: 500 }}>
//             {plan.tagline}
//           </div>
//         </div>

//         {/* price */}
//         <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${plan.highlight ? 'rgba(255,255,255,0.12)' : '#F3F4F6'}` }}>
//           {plan.pricePerDelivery > 0 ? (
//             <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
//               <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', color: plan.highlight ? '#34D399' : '#111827', lineHeight: 1 }}>
//                 ₹{price}
//               </span>
//               <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.5)' : '#9CA3AF', marginBottom: 4, fontWeight: 500 }}>
//                 /delivery
//               </span>

//             </div>
//           ) : (
//             <div style={{ fontSize: 32, fontWeight: 900, color: plan.highlight ? '#34D399' : '#111827', letterSpacing: '-1px' }}>Custom</div>
//           )}
//           <div style={{ marginTop: 6, fontSize: 13, color: plan.highlight ? '#6EE7B7' : '#059669', fontWeight: 700 }}>
//             {plan.perCan}
//           </div>
//           <div style={{ marginTop: 7, fontSize: 11, fontWeight: 700, color: plan.highlight ? '#A7F3D0' : '#64748B' }}>Delivery included · No separate water handling fee</div>
//           {typeof plan.cansPerDelivery === 'number' && (
//             <div style={{ marginTop: 3, fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}>
//               {plan.id === 'pay-per-can' ? 'Example total for 1 can' : `Up to ${plan.cansPerDelivery} cans per delivery`}
//             </div>
//           )}
//           {plan.id !== 'pay-per-can' && plan.id !== 'business' ? (
//             <div style={{ marginTop: 4, fontSize: 12, color: plan.highlight ? '#A7F3D0' : '#64748B' }}>
//               Schedule: {frequency === 'weekly' ? 'weekly' : 'monthly'} · pay per delivery
//             </div>
//           ) : null}
//         </div>

//         {/* features */}
//         <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
//           {plan.features.map((f) => (
//             <li key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
//               {f.included ? <IconCheck /> : <IconX />}
//               <span style={{ fontSize: 13, fontWeight: 500, color: plan.highlight ? (f.included ? '#D1FAE5' : 'rgba(255,255,255,0.35)') : (f.included ? '#374151' : '#9CA3AF'), lineHeight: 1.4 }}>
//                 {f.text}
//               </span>
//             </li>
//           ))}
//         </ul>

//         {/* CTA */}
//         <button
//           type="button"
//           onClick={onCta}
//           style={{
//             marginTop: 24,
//             width: '100%',
//             padding: '13px 0',
//             borderRadius: 13,
//             fontWeight: 800,
//             fontSize: 14,
//             cursor: 'pointer',
//             letterSpacing: '-0.2px',
//             transition: 'all 0.2s',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             gap: 7,
//             ...ctaStyles[plan.ctaVariant],
//           }}
//         >
//           {plan.cta}
//           <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
//             <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//           </svg>
//         </button>
//       </div>
//     </article>
//   );
// }

// // ─── FAQ accordion ────────────────────────────────────────────────────────────
// function FaqAccordion({ faq }: { faq: FaqItem[] }) {
//   const [open, setOpen] = useState<number | null>(0);
//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
//       {faq.map((item, idx) => {
//         const isOpen = open === idx;
//         return (
//           <div key={item.q} style={{ borderRadius: 14, border: `1.5px solid ${isOpen ? '#0D9B6C' : '#E5E7EB'}`, background: isOpen ? '#F0FDF4' : '#fff', overflow: 'hidden', transition: 'all 0.2s' }}>
//             <button
//               type="button"
//               onClick={() => setOpen(cur => cur === idx ? null : idx)}
//               style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
//             >
//               <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{item.q}</span>
//               <span style={{ fontSize: 18, color: '#0D9B6C', fontWeight: 700, flexShrink: 0, transform: isOpen ? 'rotate(45deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>+</span>
//             </button>
//             {isOpen && (
//               <div style={{ padding: '0 20px 16px', fontSize: 13, color: '#4B5563', lineHeight: 1.65 }}>{item.a}</div>
//             )}
//           </div>
//         );
//       })}
//     </div>
//   );
// }

// // Launch water-can rates are shared by the page and its comparison table.
// const NORMAL_RO_PRICE = 20;
// const CHILLED_RO_PRICE = 25;
// const RECURRING_RO_PRICE = 20;

// // ─── Compare table ────────────────────────────────────────────────────────────
// function CompareTable({ settings }: { settings: PlatformSettings }) {
//   const rows = [
//     { feature: 'Per-can rate', payg: `₹${NORMAL_RO_PRICE}`, starter: `₹${RECURRING_RO_PRICE}`, pro: `₹${RECURRING_RO_PRICE}`, office: `₹${NORMAL_RO_PRICE}`, business: 'Quote' },
//     { feature: 'Separate water handling fee', payg: 'None for water cans', starter: 'None for water cans', pro: 'None for water cans', office: 'None for water cans', business: 'Confirmed in quote' },
//     { feature: 'Cans per delivery', payg: 'As needed', starter: 'Up to 10', pro: 'Up to 20', office: `${Math.max(50, settings.bulk_threshold)}+`, business: 'Custom' },
//     { feature: 'Recurring schedule', payg: 'Not required', starter: 'Weekly / monthly', pro: 'Weekly / monthly', office: 'Weekly / monthly', business: 'By agreement' },
//     { feature: 'Payment', payg: 'Cash / UPI', starter: 'Cash / UPI per delivery', pro: 'Cash / UPI per delivery', office: 'Cash / UPI per delivery', business: 'Confirmed before order' },
//     { feature: 'Automatic debit', payg: 'No', starter: 'No', pro: 'No', office: 'No', business: 'Only if separately agreed' },
//     { feature: 'Service availability', payg: 'Address checked', starter: 'Address checked', pro: 'Address checked', office: 'Capacity checked', business: 'Confirmed in quote' },
//   ];
//   const cols = ['Feature', 'Pay as you go', 'Home Starter', 'Family', 'Bulk Delivery', 'Business / Society'];

//   return (
//     <div style={{ overflowX: 'auto', borderRadius: 18, border: '1.5px solid #E5E7EB', background: '#fff' }}>
//       <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
//         <thead>
//           <tr style={{ background: '#F9FAFB' }}>
//             {cols.map((c, i) => (
//               <th key={c} style={{
//                 padding: '14px 18px',
//                 textAlign: i === 0 ? 'left' : 'center',
//                 fontWeight: 700,
//                 color: i === 2 ? '#065F46' : '#374151',
//                 fontSize: 12,
//                 letterSpacing: '0.04em',
//                 borderBottom: '1.5px solid #E5E7EB',
//                 background: i === 2 ? '#ECFDF5' : undefined,
//               }}>
//                 {c}{i === 2 ? ' ⭐' : ''}
//               </th>
//             ))}
//           </tr>
//         </thead>
//         <tbody>
//           {rows.map((row, ri) => (
//             <tr key={row.feature} style={{ background: ri % 2 === 0 ? '#fff' : '#F9FAFB' }}>
//               <td style={{ padding: '13px 18px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #F3F4F6' }}>{row.feature}</td>
//               {[row.payg, row.starter, row.pro, row.office, row.business].map((val, ci) => (
//                 <td key={ci} style={{
//                   padding: '13px 18px',
//                   textAlign: 'center',
//                   color: ci === 1 ? '#065F46' : val === '—' ? '#D1D5DB' : '#374151',
//                   fontWeight: ci === 1 ? 700 : 500,
//                   borderBottom: '1px solid #F3F4F6',
//                   background: ci === 1 ? 'rgba(236,253,245,0.4)' : undefined,
//                 }}>
//                   {val}
//                 </td>
//               ))}
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// // ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
// export default function PricingPage() {
//   const router = useRouter();
//   const [tab, setTab] = useState<PricingTab>('individual');
//   const [billing, setBilling] = useState<BillingCycle>('weekly');
//   const [showCompare, setShowCompare] = useState(false);
//   const { settings } = useSettings();
//   // Keep public plan totals aligned with the server-authoritative launch
//   // pricing in /api/customer/orders. The API currently fixes Normal RO at ₹20,
//   // Chilled RO at ₹25 and recurring Normal RO at ₹18; legacy/bulk settings must
//   // not make public cards advertise prices the order API will reject.
//   const deliveryTotal = (quantity: number, orderType: 'one_time' | 'subscription' = 'subscription') => {
//     const unit = orderType === 'subscription' ? RECURRING_RO_PRICE : NORMAL_RO_PRICE;
//     return quantity * unit;
//   };
//   const officeQuantity = Math.max(50, settings.bulk_threshold);

//   const faq: FaqItem[] = useMemo(() => [
//     { q: 'What is the minimum order for can delivery?', a: 'You can order one 20L can on a pay-as-you-go basis. The current per-can rate and final total are shown before you confirm; water-can orders have no separate handling fee.' },
//     { q: 'How does recurring delivery work?', a: 'Choose the number of cans per delivery and a weekly or monthly schedule. Each delivery is charged separately by cash or UPI; there is no automatic debit. You can pause or cancel future deliveries.' },
//     { q: 'Can I mix can delivery and other services?', a: 'Yes! Book tanker delivery, RO service, or plumbing alongside your can subscription — all from one account.' },
//     { q: 'What payment methods are accepted?', a: 'Recurring water deliveries currently support cash or UPI payment per delivery. Other payment options are shown only when available in the booking flow.' },
//     { q: 'Can I pause or cancel recurring deliveries?', a: 'You can pause, resume or cancel future deliveries from your subscriptions page. Orders already in progress may not be cancellable.' },
//     { q: 'Are taxes and order fees included?', a: 'The final payable total is shown before you confirm. Water-can orders currently have no separate handling fee. Any legally applicable tax treatment must be verified for the supplier and service before it is advertised as included.' },
//     { q: 'Where is AuroWater available?', a: 'Live service zones currently cover eligible areas of Kanpur, Lucknow and Gorakhpur. Availability is confirmed from your delivery address; other areas may be added later.' },
//     { q: 'How do I change a recurring plan?', a: 'Pause or cancel the existing schedule and create a new booking with the quantity and frequency you need.' },
//   ], []);

//   const individualPlans: SubPlan[] = [
//     {
//       id: 'pay-per-can',
//       name: 'Pay as you go',
//       tagline: 'No commitment. Order only when needed.',
//       pricePerDelivery: deliveryTotal(1, 'one_time'),
//       unitPrice: NORMAL_RO_PRICE,
//       cansPerDelivery: 1,
//       perCan: `₹${NORMAL_RO_PRICE}/can (no separate water handling fee) before any legally applicable tax`,
//       features: [
//         { text: '20L water can delivery', included: true },
//         { text: 'Choose from available delivery slots', included: true },
//         { text: 'Pay on delivery (Cash/UPI)', included: true },
//         { text: 'View order status in your account', included: true },
//         { text: 'Subscription discount', included: false },
//         { text: 'Scheduled repeat deliveries', included: false },
//         { text: 'Priority support', included: false },
//       ],
//       cta: 'Order a Can',
//       ctaVariant: 'outline',
//     },
//     {
//       id: 'starter',
//       name: 'Home Starter',
//       tagline: 'A convenient recurring schedule for home.',
//       badge: 'Most Popular',
//       badgeColor: 'green',
//       pricePerDelivery: deliveryTotal(10),
//       unitPrice: RECURRING_RO_PRICE,
//       cansPerDelivery: 10,
//       perCan: `₹${RECURRING_RO_PRICE}/can · same rate as one-time Normal RO (no separate water handling fee) before any legally applicable tax`,
//       features: [
//         { text: '10 cans per delivery at the recurring rate', included: true },
//         { text: 'Flexible delivery schedule', included: true },
//         { text: 'Select weekly or monthly delivery', included: true },
//         { text: 'Pay on delivery (Cash/UPI)', included: true },
//         { text: 'Pay separately for each delivery', included: true },
//         { text: 'Pause or cancel future deliveries', included: true },
//         { text: 'Priority support', included: false },
//       ],
//       cta: 'Start Starter Plan',
//       ctaVariant: 'primary',
//       highlight: true,
//     },
//     {
//       id: 'pro',
//       name: 'Family',
//       tagline: 'For households that need more cans per delivery.',
//       badge: 'Best Value',
//       badgeColor: 'blue',
//       pricePerDelivery: deliveryTotal(20),
//       unitPrice: RECURRING_RO_PRICE,
//       cansPerDelivery: 20,
//       perCan: `₹${RECURRING_RO_PRICE}/can · same rate as one-time Normal RO (no separate water handling fee) before any legally applicable tax`,
//       features: [
//         { text: '20 cans per delivery at the recurring rate', included: true },
//         { text: 'Choose weekly or monthly delivery', included: true },
//         { text: 'Clear total before each booking', included: true },
//         { text: 'Cash or UPI payment per delivery', included: true },
//         { text: 'Order history and status updates', included: true },
//         { text: 'Pause or cancel future deliveries', included: true },
//         { text: 'No automatic debit', included: true },
//       ],
//       cta: 'Start Pro Plan',
//       ctaVariant: 'outline',
//     },
//   ];

//   const businessPlans: SubPlan[] = [
//     {
//       id: 'office',
//       name: 'Bulk Delivery',
//       tagline: 'For offices, shops and high-volume households.',
//       badge: 'Popular',
//       badgeColor: 'amber',
//       pricePerDelivery: deliveryTotal(officeQuantity, 'one_time'),
//       unitPrice: settings.bulk_can_price,
//       cansPerDelivery: officeQuantity,
//       perCan: `₹${settings.bulk_can_price}/can (no separate water handling fee) before any legally applicable tax`,
//       features: [
//         { text: `${officeQuantity} cans per delivery at the bulk rate`, included: true },
//         { text: 'Scheduled bulk deliveries', included: true },
//         { text: 'Final total shown before confirmation', included: true },
//         { text: 'Scheduled recurring delivery', included: true },
//         { text: 'Cash or UPI payment per delivery', included: true },
//         { text: 'Dedicated account manager', included: false },
//         { text: 'Delivery availability depends on your area', included: true },
//       ],
//       cta: 'Get Office Plan',
//       ctaVariant: 'outline',
//     },
//     {
//       id: 'business',
//       name: 'Business / Society',
//       tagline: 'For bulk supply enquiries and multiple-site needs.',
//       badge: 'Enterprise',
//       badgeColor: 'green',
//       pricePerDelivery: 0,
//       unitPrice: null,
//       cansPerDelivery: 'Custom volume',
//       perCan: 'Request a volume and locality-based quote',
//       features: [
//         { text: 'Custom volume and delivery schedule', included: true },
//         { text: 'Confirm address coverage before contracting', included: true },
//         { text: 'Supplier capacity and service area confirmed', included: true },
//         { text: 'Written price and service terms before order', included: true },
//         { text: 'Ask about business documentation needs', included: true },
//         { text: 'No unconfirmed service add-ons', included: true },
//         { text: 'Optional related services quoted separately', included: true },
//       ],
//       cta: 'Get Custom Quote',
//       ctaVariant: 'dark',
//       highlight: true,
//     },
//   ];

//   const activePlans = tab === 'individual' ? individualPlans : businessPlans;

//   const handlePlanCta = (plan: SubPlan) => {
//     if (plan.id === 'business' || plan.id === 'pay-per-can') {
//       if (plan.id === 'business') window.open(WHATSAPP, '_blank', 'noopener,noreferrer');
//       else router.push('/book?service=water_can');
//     } else {
//       router.push(`/book?service=water_can&plan=${plan.id}&frequency=${billing}`);
//     }
//   };

//   return (
//     <>
//       <style>{`
//         /* Use system font fallbacks to avoid render-blocking third-party font requests. */
//         .pricing-page * { box-sizing: border-box; font-family: 'DM Sans', system-ui, sans-serif; }
//         .pricing-page h1, .pricing-page h2, .pricing-page .display { font-family: 'Syne', system-ui, sans-serif; }
//         @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,0.2);} 50%{box-shadow:0 0 0 7px rgba(16,185,129,0.06);} }
//         .pricing-hero-illustration { position: absolute; right: max(20px, calc((100vw - 1160px) / 2)); top: 50%; transform: translateY(-50%); width: min(30vw, 340px); height: auto; opacity: .94; pointer-events: none; }
//         @media (max-width: 900px) { .pricing-hero-illustration { display: none; } }
//         .pricing-page .plan-card { animation: fadeUp 0.5s ease both; }
//         .pricing-page .plan-card:nth-child(1){animation-delay:0ms}
//         .pricing-page .plan-card:nth-child(2){animation-delay:80ms}
//         .pricing-page .plan-card:nth-child(3){animation-delay:160ms}
//         .pricing-page input[type=range]::-webkit-slider-thumb { width:18px;height:18px;border-radius:50%;background:#38BDF8;cursor:pointer;-webkit-appearance:none; }
//         .pricing-page input[type=range]::-webkit-slider-runnable-track { height:4px;border-radius:4px;background:rgba(255,255,255,0.2); }
//         .pricing-page .billing-toggle button { transition: all 0.2s; }
//       `}</style>

//       <div className="pricing-page" style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#F0FDF8 0%,#F8FAFC 50%,#fff 100%)' }}>

//         {/* ── HERO ── */}
//         <div style={{ background: 'linear-gradient(135deg,#022C22 0%,#064E3B 55%,#0D9B6C 100%)', padding: '68px 24px 100px', position: 'relative', overflow: 'hidden' }}>
//           <div style={{ position:'absolute',inset:0,opacity:0.06,backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)',backgroundSize:'28px 28px',pointerEvents:'none' }} />
//           <div style={{ position:'absolute',top:-100,right:-80,width:360,height:360,borderRadius:'50%',background:'#34D399',opacity:0.07,pointerEvents:'none' }} />
//           <div style={{ position:'absolute',bottom:-60,left:-60,width:240,height:240,borderRadius:'50%',background:'#0D9B6C',opacity:0.06,pointerEvents:'none' }} />
//           <Image
//             src="/illustrations/water-can-delivery.svg"
//             alt=""
//             aria-hidden="true"
//             width={640}
//             height={420}
//             priority
//             sizes="(max-width: 900px) 0px, 32vw"
//             className="pricing-hero-illustration"
//           />

//           <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative', zIndex: 1 }}>
//             {/* trust pill */}
//             <div style={{ display:'inline-flex',alignItems:'center',gap:8,background:'rgba(52,211,153,0.15)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:999,padding:'6px 14px',marginBottom:20 }}>
//               <span style={{ width:7,height:7,borderRadius:'50%',background:'#34D399',display:'inline-block',animation:'pulse 2s infinite' }} />
//               <span style={{ fontSize:12,fontWeight:700,color:'#6EE7B7',letterSpacing:'0.07em' }}>SERVING KANPUR, LUCKNOW & GORAKHPUR</span>
//             </div>

// {/* Main headline — ALL IN ONE H1 */}
// <h1 className="syne" style={{
//   margin: '0 0 20px',
//   fontWeight: 900,
//   lineHeight: 1.0,           // ← NOT 0.93 — that only works for display posters
//   letterSpacing: '-1.5px',   // ← NOT -3px — that's only for 80px+ sizes
//   maxWidth: 640,
// }}>
//   <span style={{ display: 'block', fontSize: 'clamp(2rem, 3.8vw, 3.6rem)', color: '#fff' }}>
//     Clear water-can pricing.
//   </span>
//   <span style={{ display: 'block', fontSize: 'clamp(2rem, 3.8vw, 3.6rem)', color: '#34D399' }}>
//     20L cans from ₹{NORMAL_RO_PRICE}.
//   </span>

//   {/* visual divider inside h1 */}
//   <span style={{ display: 'block', height: 1, background: 'rgba(255,255,255,0.1)', maxWidth: 360, margin: '18px 0' }} />

//   <span style={{ display: 'block', fontSize: 'clamp(1.5rem, 2.8vw, 2.6rem)', color: '#fff', letterSpacing: '-1px' }}>
//     Recurring delivery at{' '}
//     <span style={{ color: '#34D399' }}>₹{RECURRING_RO_PRICE} / Can.</span>{' '}
//     <span style={{ color: 'rgba(255,255,255,0.62)' }}>Final rate shown before booking.</span>
//   </span>
// </h1>
//             <p style={{ margin:'18px 0 0',fontSize:17,color:'rgba(255,255,255,0.65)',maxWidth:480,lineHeight:1.65 }}>
//               Normal RO ₹{NORMAL_RO_PRICE} and Chilled RO ₹{CHILLED_RO_PRICE} per 20L can, with delivery included and no separate water handling fee. Need a water-system repair? Book a plumber from AuroWater too. Review your payable total before confirming.
//             </p>
//             <div style={{ display:'flex',flexWrap:'wrap',gap:10,marginTop:18 }}>
//               <button type="button" onClick={() => router.push('/book?service=water_can&water=normal')} style={{ border:0,borderRadius:999,padding:'12px 18px',background:'#06B6D4',color:'#082F49',fontWeight:800,cursor:'pointer' }}>Order Normal RO</button>
//               <button type="button" onClick={() => router.push('/book?service=plumbing')} style={{ border:'1px solid rgba(255,255,255,.35)',borderRadius:999,padding:'12px 18px',background:'rgba(255,255,255,.1)',color:'#fff',fontWeight:800,cursor:'pointer' }}>Find a Plumber</button>
//             </div>

//             {/* hero value props */}
//             <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginTop:28 }}>
//               {[`₹${RECURRING_RO_PRICE}/can on recurring deliveries · same per-can rate`, '50+ cans: confirm volume quote before booking', 'Pause future deliveries', 'Cash or UPI per delivery'].map(t => (
//                 <div key={t} style={{ display:'flex',alignItems:'center',gap:7,background:'rgba(255,255,255,0.09)',borderRadius:999,padding:'7px 14px',border:'1px solid rgba(255,255,255,0.12)' }}>
//                   <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#34D399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
//                   <span style={{ fontSize:13,color:'rgba(255,255,255,0.85)',fontWeight:600 }}>{t}</span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* ── CAN HIGHLIGHT BAND ── */}
//        {/* ═══════════════════════════════════════════════════════════════
//     PRICING CARD BLOCK — paste directly inside your page's return()
//     Requires: router from useRouter() already declared in parent
//     Requires: Google Fonts (Syne + DM Sans) in your layout or _document
//     ═══════════════════════════════════════════════════════════════ */}

// {/* ── Styles ── */}
// <style>{`
//   /* Use system font fallbacks to avoid render-blocking third-party font requests. */

//   .pc-root {
//     max-width: 1160px;
//     margin: -40px auto 0;
//     padding: 0 24px;
//     position: relative;
//     z-index: 10;
//   }
//   .pc-card {
//     background: #fff;
//     border-radius: 22px;
//     border: 1px solid #E2EDE9;
//     box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05), 0 24px 56px rgba(13,155,108,0.08);
//     overflow: hidden;
//     font-family: 'DM Sans', sans-serif;
//   }
//   .pc-accent-bar {
//     height: 3px;
//     background: linear-gradient(90deg, #0D9B6C 0%, #34D399 50%, #0D9B6C 100%);
//   }
//   .pc-grid {
//     display: grid;
//     grid-template-columns: auto 1px 1fr;
//     align-items: stretch;
//   }
//   .pc-left {
//     display: flex;
//     align-items: center;
//     gap: 16px;
//     padding: 24px 28px;
//   }
//   .pc-icon {
//     width: 52px; height: 52px;
//     border-radius: 15px;
//     background: #F0FDF9;
//     border: 1px solid #D1FAE5;
//     display: flex; align-items: center; justify-content: center;
//     flex-shrink: 0;
//   }
//   .pc-label {
//     font-size: 10px; font-weight: 700; color: #6B7280;
//     letter-spacing: 0.1em; text-transform: uppercase;
//   }
//   .pc-badge {
//     font-size: 9px; font-weight: 700; color: #065F46;
//     background: #ECFDF5; border: 1px solid #A7F3D0;
//     padding: 2px 7px; border-radius: 99px;
//     letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;
//   }
//   .pc-price-main {
//     font-family: 'Syne', sans-serif; font-weight: 900;
//     font-size: 30px; color: #0F1C18;
//     letter-spacing: -1.5px; line-height: 1;
//   }
//   .pc-save-pill {
//     display: inline-flex; align-items: center; gap: 4px;
//     background: #FEF9C3; border: 1px solid #FDE047;
//     padding: 3px 8px; border-radius: 6px;
//     font-size: 11px; font-weight: 700; color: #78350F;
//   }
//   .pc-vdivider {
//     width: 1px; align-self: stretch;
//     background: linear-gradient(to bottom, transparent 10%, #E5E7EB 40%, #E5E7EB 60%, transparent 90%);
//   }
//   .pc-right {
//     display: flex; flex-direction: column;
//     justify-content: center; gap: 16px;
//     padding: 22px 24px 22px 28px;
//   }
//   .pc-tiers { display: flex; gap: 10px; flex-wrap: nowrap; }
//   .pc-tier {
//     border-radius: 13px; padding: 12px 16px; cursor: pointer;
//     position: relative; flex: 0 0 auto; width: 130px;
//     transition: transform 0.18s ease, box-shadow 0.18s ease;
//   }
//   .pc-tier:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.09); }
//   .pc-tier-label {
//     font-size: 9px; font-weight: 700;
//     letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px;
//   }
//   .pc-tier-price {
//     font-family: 'Syne', sans-serif; font-weight: 900;
//     font-size: 18px; letter-spacing: -0.5px; line-height: 1.1;
//   }
//   .pc-tier-sub { font-size: 10px; font-weight: 500; margin-top: 2px; }
//   .pc-best-pin {
//     position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
//     background: #0D9B6C; color: #fff;
//     font-size: 8px; font-weight: 700; letter-spacing: 0.08em;
//     padding: 2px 8px 3px; border-radius: 99px;
//     text-transform: uppercase; white-space: nowrap;
//   }
//   .pc-cta-row { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; }
//   .pc-cta-btn {
//     background: #0D9B6C; color: #fff;
//     font-family: 'DM Sans', sans-serif; font-weight: 700;
//     font-size: 14px; letter-spacing: -0.2px;
//     padding: 13px 24px; border-radius: 13px; border: none; cursor: pointer;
//     display: inline-flex; align-items: center; gap: 8px;
//     white-space: nowrap; flex-shrink: 0;
//     box-shadow: 0 4px 16px rgba(13,155,108,0.30);
//     transition: transform 0.18s ease, box-shadow 0.18s ease;
//   }
//   .pc-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(13,155,108,0.40); }
//   .pc-cta-btn:active { transform: scale(0.97); }
//   .pc-cta-arrow {
//     background: rgba(255,255,255,0.2); padding: 2px 7px;
//     border-radius: 6px; font-size: 11px; font-weight: 600;
//   }
//   .pc-trust {
//     display: flex; align-items: center; gap: 5px;
//     font-size: 11px; color: #9CA3AF; font-weight: 500; white-space: nowrap;
//   }
//   .pc-trust-dot {
//     width: 3px; height: 3px; border-radius: 50%;
//     background: #D1D5DB; flex-shrink: 0; display: inline-block;
//   }

//   /* ── Tablet ≤ 960px ── */
//   @media (max-width: 960px) {
//     .pc-grid { grid-template-columns: 1fr; }
//     .pc-vdivider { display: none; }
//     .pc-left { padding: 22px 22px 16px; border-bottom: 1px solid #F1F5F9; }
//     .pc-right { padding: 18px 22px 22px; }
//     .pc-tiers { flex-wrap: wrap; }
//     .pc-tier { flex: 1 1 120px; width: auto; }
//     .pc-cta-row { flex-wrap: wrap; }
//   }

//   /* ── Mobile ≤ 560px ── */
//   @media (max-width: 560px) {
//     .pc-root { padding: 0 16px; margin-top: -28px; }
//     .pc-card { border-radius: 18px; }
//     .pc-left { padding: 18px 18px 14px; gap: 12px; }
//     .pc-icon { width: 44px; height: 44px; border-radius: 12px; }
//     .pc-price-main { font-size: 26px; }
//     .pc-right { padding: 16px 18px 20px; gap: 14px; }
//     .pc-tiers { flex-direction: column; gap: 10px; }
//     .pc-tier { width: 100%; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; }
//     .pc-tier-price { font-size: 16px; }
//     .pc-cta-btn { width: 100%; justify-content: center; }
//     .pc-trust { flex-wrap: wrap; }
//   }

//   /* ── Tiny ≤ 360px ── */
//   @media (max-width: 360px) {
//     .pc-price-main { font-size: 22px; }
//     .pc-left { gap: 10px; }
//   }
// `}</style>

// {/* ── Card ── */}
// <div className="pc-root">
//   <div className="pc-card">

//     {/* Accent bar */}
//     <div className="pc-accent-bar" />

//     <div className="pc-grid">

//       {/* ─── LEFT: Product identity ─── */}
//       <div className="pc-left">
//         <div className="pc-icon">
//           <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
//             <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="#0D9B6C" fillOpacity={0.2} />
//             <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#0D9B6C" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
//           </svg>
//         </div>

//         <div>
//           {/* Label + badge */}
//           <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' as const }}>
//             <span className="pc-label">20L Water Can</span>
//             <span className="pc-badge">Price shown before booking</span>
//           </div>

//           {/* Price */}
//           <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '4px 0 6px', flexWrap: 'wrap' as const }}>
//             <span className="pc-price-main">₹{NORMAL_RO_PRICE}</span>
//             <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>/ can · one-time</span>
//           </div>

//           <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
//             <span className="pc-save-pill">Delivery included · No separate water delivery fee</span>
//           </div>
//         </div>
//       </div>

//       {/* ─── Vertical divider ─── */}
//       <div className="pc-vdivider" />

//       {/* ─── RIGHT: Tiers + CTA ─── */}
//       <div className="pc-right">

//         {/* Tier pills */}
//         <div className="pc-tiers">
//           {(
//             [
//               { label: 'Pay-as-you-go', sublabel: 'No commitment', price: `₹${NORMAL_RO_PRICE}/can`, bg: '#F8FAFF', border: '1px solid #DBEAFE', tc: '#1E3A8A', lc: '#3B82F6', sc: '#93C5FD', best: false },
//               { label: 'Subscription', sublabel: 'Recurring delivery', price: `₹${RECURRING_RO_PRICE}/can · Same per-can rate`, bg: '#F0FDF9', border: '1.5px solid #0D9B6C', tc: '#065F46', lc: '#0D9B6C', sc: '#6EE7B7', best: false },
//               { label: `Bulk ${settings.bulk_threshold}+`, sublabel: 'Confirm volume quote before booking', price: 'Quote required', bg: '#FFFBEB', border: '1px solid #FDE68A', tc: '#78350F', lc: '#D97706', sc: '#FCD34D', best: false },
//             ] as const
//           ).map((t) => (
//             <div
//               key={t.label}
//               className="pc-tier"
//               style={{ background: t.bg, border: t.border }}
//             >
//               {t.best && <div className="pc-best-pin">Best value</div>}
//               <div>
//                 <div className="pc-tier-label" style={{ color: t.lc }}>{t.label}</div>
//                 <div className="pc-tier-price" style={{ color: t.tc }}>{t.price}</div>
//               </div>
//               <div className="pc-tier-sub" style={{ color: t.sc }}>{t.sublabel}</div>
//             </div>
//           ))}
//         </div>

//         {/* CTA + trust */}
//         <div className="pc-cta-row">
//           <button
//             type="button"
//             onClick={() => router.push('/book?service=water_can')}
//             className="pc-cta-btn"
//           >
//             <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
//               <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="rgba(255,255,255,0.35)" />
//               <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
//             </svg>
//             Order a Can Now
//             <span className="pc-cta-arrow">→</span>
//           </button>

//           <div className="pc-trust">
//             <span>Availability checked for your address</span>
//             <span className="pc-trust-dot" />
//             <span>Clear order total</span>
//             <span className="pc-trust-dot" />
//             <span>Pause future deliveries</span>
//           </div>
//         </div>

//       </div>
//     </div>

//   </div>
// </div>

//         {/* Water product prices — kept separate from subscription plan pricing. */}
//         <section aria-labelledby="water-products-title" style={{ maxWidth:1160, margin:'0 auto', padding:'34px 24px 0' }}>
//           <div style={{ marginBottom:18 }}>
//             <h2 id="water-products-title" style={{ margin:0, fontSize:'clamp(1.35rem,3vw,1.8rem)', fontWeight:900, color:'#0F172A' }}>Choose your water</h2>
//             <p style={{ margin:'6px 0 0', color:'#64748B', fontSize:14 }}>Straightforward pricing for everyday use or events.</p>
//           </div>
//           <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:16 }}>
//             <article style={{ background:'#fff', border:'1px solid #D1FAE5', borderRadius:18, padding:22 }}>
//               <p style={{ margin:0, color:'#047857', fontSize:11, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase' }}>Everyday essential</p>
//               <h3 style={{ margin:'8px 0 0', color:'#0F172A', fontSize:20, fontWeight:900 }}>Normal RO Water</h3>
//               <p style={{ margin:'8px 0 0', color:'#047857', fontSize:30, fontWeight:900 }}>₹{NORMAL_RO_PRICE}<span style={{ fontSize:13, fontWeight:600, color:'#64748B' }}> / 20L can</span></p>
//               <p style={{ margin:'8px 0 16px', color:'#64748B', fontSize:13 }}>For daily home and office drinking-water needs. Delivery included in the displayed water-can price.</p>
//               <button type="button" onClick={() => router.push('/book?service=water_can&water=normal')} style={{ width:'100%', padding:'12px 16px', borderRadius:11, border:0, background:'#047857', color:'#fff', fontWeight:800, cursor:'pointer' }}>Order Normal RO</button>
//             </article>
//             <article style={{ background:'#fff', border:'1px solid #BAE6FD', borderRadius:18, padding:22 }}>
//               <p style={{ margin:0, color:'#0369A1', fontSize:11, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase' }}>For events & gatherings</p>
//               <h3 style={{ margin:'8px 0 0', color:'#0F172A', fontSize:20, fontWeight:900 }}>Chilled RO Water</h3>
//               <p style={{ margin:'8px 0 0', color:'#0369A1', fontSize:30, fontWeight:900 }}>₹{CHILLED_RO_PRICE}<span style={{ fontSize:13, fontWeight:600, color:'#64748B' }}> / 20L can</span></p>
//               <p style={{ margin:'8px 0 16px', color:'#64748B', fontSize:13 }}>Chilled and delivered for weddings, parties, functions and office gatherings.</p>
//               <button type="button" onClick={() => router.push('/book?service=water_can&water=chilled')} style={{ width:'100%', padding:'12px 16px', borderRadius:11, border:0, background:'#0369A1', color:'#fff', fontWeight:800, cursor:'pointer' }}>Order Chilled Water</button>
//             </article>
//           </div>
//         </section>

//         {/* ── MAIN CONTENT ── */}
//         <div style={{ maxWidth:1160,margin:'0 auto',padding:'52px 24px 80px' }}>

//           {/* section header + tab toggle */}
//           <div style={{ display:'flex',flexWrap:'wrap',gap:16,alignItems:'flex-end',justifyContent:'space-between',marginBottom:28 }}>
//             <div>
//               <h2 style={{ margin:0,fontSize:'clamp(1.5rem,3.5vw,2.2rem)',fontWeight:900,color:'#111827',letterSpacing:'-0.8px' }}>
//                 Choose your plan
//               </h2>
//               <p style={{ margin:'6px 0 0',fontSize:14,color:'#6B7280' }}>Transparent per-delivery pricing. Pause or cancel future deliveries.</p>
//             </div>

//             <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10 }}>
//               {/* Individual / Business tab */}
//               <div style={{ display:'flex',background:'#F3F4F6',borderRadius:12,padding:4,gap:3 }}>
//                 {(['individual','business'] as PricingTab[]).map(t => (
//                   <button
//                     key={t}
//                     type="button"
//                     onClick={() => setTab(t)}
//                     style={{ padding:'8px 18px',borderRadius:9,fontWeight:700,fontSize:13,border:'none',cursor:'pointer',background:tab===t?'#fff':'transparent',color:tab===t?'#111827':'#6B7280',boxShadow:tab===t?'0 1px 6px rgba(0,0,0,0.1)':'none',transition:'all 0.2s' }}
//                   >
//                     {t === 'individual' ? '👤 Individual' : '🏢 Business'}
//                   </button>
//                 ))}
//               </div>

//               {/* Delivery frequency toggle */}
//               <div className="billing-toggle" style={{ display:'flex',alignItems:'center',gap:8,background:'#F9FAFB',borderRadius:999,padding:'5px 8px',border:'1.5px solid #E5E7EB' }} aria-label="Delivery frequency">
//                 <button type="button" onClick={() => setBilling('weekly')} style={{ padding:'5px 14px',borderRadius:999,fontWeight:700,fontSize:12,border:'none',cursor:'pointer',background:billing==='weekly'?'#fff':'transparent',color:billing==='weekly'?'#111827':'#9CA3AF',boxShadow:billing==='weekly'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>Weekly</button>
//                 <button type="button" onClick={() => setBilling('monthly')} style={{ padding:'5px 14px',borderRadius:999,fontWeight:700,fontSize:12,border:'none',cursor:'pointer',background:billing==='monthly'?'#fff':'transparent',color:billing==='monthly'?'#111827':'#9CA3AF',boxShadow:billing==='monthly'?'0 1px 4px rgba(0,0,0,0.08)':'none',display:'flex',alignItems:'center',gap:5 }}>
//                   Monthly
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* Plan cards */}
//           <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:22 }}>
//             {activePlans.map(plan => (
//               <div key={plan.id} className="plan-card">
//                 <SubCard plan={plan} frequency={billing} onCta={() => handlePlanCta(plan)} />
//               </div>
//             ))}
//           </div>

//           <p style={{ margin: '12px 0 0', fontSize: 11, lineHeight: 1.6, color: '#64748B' }}>
//           </p>

//           {/* Compare table toggle */}
//           <div style={{ textAlign:'center',marginTop:28 }}>
//             <button
//               type="button"
//               onClick={() => setShowCompare(v => !v)}
//               style={{ background:'none',border:'1.5px solid #E5E7EB',borderRadius:12,padding:'10px 22px',fontSize:13,fontWeight:700,color:'#374151',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7 }}
//             >
//               {showCompare ? 'Hide' : 'Compare all plans'}
//               <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ transform:showCompare?'rotate(180deg)':'none',transition:'transform 0.2s' }}><path d="M2.5 4.5L6.5 8.5L10.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
//             </button>
//           </div>

//           {showCompare && (
//             <div style={{ marginTop:22, animation:'fadeUp 0.3s ease both' }}>
//               <CompareTable settings={settings} />
//             </div>
//           )}

//           {/* Honest value proposition: no unverified competitor-price claims. */}
//           <div style={{ marginTop:60, border:'1px solid #D1FAE5', background:'linear-gradient(135deg,#F0FDF4,#F0FDFA)', borderRadius:20, padding:24 }}>
//             <h2 style={{ margin:0,fontSize:'clamp(1.3rem,3vw,2rem)',fontWeight:900,color:'#064E3B',letterSpacing:'-0.5px' }}>A simpler way to manage water delivery</h2>
//             <p style={{ margin:'8px 0 0',fontSize:14,lineHeight:1.7,color:'#475569' }}>Choose one-time delivery when you need it, or schedule recurring deliveries for convenience. There is no automatic debit. The price shown for each delivery is reviewed before you confirm, and you can pause or cancel future schedules.</p>
//           </div>

//           {/* ── Other home services pricing ── */}
//           <div style={{ marginTop:60 }}>
//             <h2 style={{ margin:'0 0 6px',fontSize:'clamp(1.3rem,3vw,2rem)',fontWeight:900,color:'#111827',letterSpacing:'-0.5px' }}>Water &amp; home services</h2>
//             <p style={{ margin:'0 0 22px',fontSize:14,color:'#6B7280' }}>Starting estimates are taken from current public settings. Confirm scope, availability and the final price before booking.</p>
//             <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16 }}>
//               {[
//                 { key:'water_tanker', emoji:'🚰',name:'Water Tanker',price:settings.service_base_prices.water_tanker,unit:'starting estimate',note:'Final quote depends on volume, access and service area.', tag:'' },
//                 { key:'plumbing', emoji:'🔧',name:'Plumbing',price:settings.service_base_prices.plumbing,unit:'starting estimate',note:'Materials and additional work may cost extra.', tag:'' },
//                 { key:'borewell', emoji:'⛏️',name:'Borewell Service',price:settings.service_base_prices.borewell,unit:'starting estimate',note:'Scope and site requirements affect the quote.', tag:'' },
//                 { key:'motor_pump', emoji:'⚙️',name:'Motor & Pump Repair',price:settings.service_base_prices.motor_pump,unit:'starting estimate',note:'Parts and repair work are quoted after diagnosis.', tag:'' },
//                 { key:'ro_service', emoji:'💧',name:'RO Service',price:settings.service_base_prices.ro_service,unit:'starting estimate',note:'Replacement parts may cost extra.', tag:'' },
//                 { key:'tank_cleaning', emoji:'🪣',name:'Tank Cleaning',price:settings.service_base_prices.tank_cleaning,unit:'starting estimate',note:'Tank capacity and access can affect the final price.', tag:'' },
//               ].map(s => (
//                 <div key={s.key} role="link" tabIndex={0} aria-label={`View details for ${s.name}`} style={{ background:'#fff',borderRadius:16,border:'1.5px solid #E5E7EB',padding:'18px 20px',display:'flex',flexDirection:'column',gap:10,transition:'all 0.2s',cursor:'pointer' }}
//                   onClick={() => router.push(`/services/${s.key}`)}
//                   onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); router.push(`/services/${s.key}`); } }}
//                   onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor='#0D9B6C'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 6px 20px rgba(13,155,108,0.1)'; }}
//                   onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor='#E5E7EB'; (e.currentTarget as HTMLDivElement).style.boxShadow='none'; }}
//                 >
//                   <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
//                     <span style={{ fontSize:28 }}>{s.emoji}</span>
//                     {s.tag && <Pill color={s.tag === 'New' ? 'blue' : 'green'}>{s.tag}</Pill>}
//                   </div>
//                   <div>
//                     <div style={{ fontWeight:800,fontSize:14,color:'#111827' }}>{s.name}</div>
//                     <div style={{ fontSize:11,color:'#6B7280',marginTop:2 }}>{s.note}</div>
//                   </div>
//                   <div style={{ display:'flex',alignItems:'baseline',gap:4 }}>
//                     <span style={{ fontSize:22,fontWeight:900,color:'#0D9B6C',letterSpacing:'-0.5px' }}>₹{s.price.toLocaleString('en-IN')}</span>
//                     <span style={{ fontSize:12,color:'#9CA3AF' }}>{s.unit}</span>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* ── AMC ── */}
//           <div style={{ marginTop:52 }}>
//             <div style={{ borderRadius:22,background:'linear-gradient(135deg,#0C4A6E,#0369A1 55%,#0284C7)',padding:'40px 36px',position:'relative',overflow:'hidden' }}>
//               <div style={{ position:'absolute',inset:0,opacity:0.05,backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)',backgroundSize:'24px 24px',pointerEvents:'none' }} />
//               <div style={{ position:'absolute',top:-80,right:-80,width:300,height:300,borderRadius:'50%',background:'#38BDF8',opacity:0.1,pointerEvents:'none' }} />
//               <div style={{ position:'relative',zIndex:1,display:'flex',flexWrap:'wrap',gap:24,alignItems:'center',justifyContent:'space-between' }}>
//                 <div>
//                   <Pill color="blue">Maintenance &amp; repeat service</Pill>
//                   <h2 style={{ margin:'12px 0 6px',fontSize:'clamp(1.3rem,3.5vw,1.8rem)',fontWeight:900,color:'#fff',letterSpacing:'-0.5px' }}>
//                     Need help maintaining your water system?
//                   </h2>
//                   <p style={{ margin:0,color:'rgba(255,255,255,0.65)',fontSize:14,lineHeight:1.6,maxWidth:440 }}>
//                     Ask for a tailored maintenance quote based on your purifier, equipment and service needs. We will confirm the included work and price before you commit.
//                   </p>
//                   <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginTop:14 }}>
//                     {['Scope agreed before work','Parts quoted separately where needed','Availability checked by area','Written quote before commitment'].map(t => (
//                       <div key={t} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.09)',borderRadius:999,padding:'5px 12px',border:'1px solid rgba(255,255,255,0.12)' }}>
//                         <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
//                         <span style={{ fontSize:12,color:'rgba(255,255,255,0.8)',fontWeight:600 }}>{t}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//                 <button type="button" onClick={() => router.push('/contact')}
//                   style={{ background:'#fff',color:'#0C4A6E',fontWeight:800,fontSize:14,padding:'14px 28px',borderRadius:14,border:'none',cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:8 }}>
//                   Request a Quote
//                   <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#0C4A6E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* ── Trust strip ── */}
//           <div style={{ marginTop:44,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14 }}>
//             {[
//               { icon:'🔒',title:'No hidden charges',sub:'Full breakdown shown at checkout.' },
//               { icon:'↩️',title:'Manage future deliveries',sub:'Pause or cancel future deliveries where supported.' },
//               { icon:'📋',title:'Tax documents',sub:'Ask support to confirm the documentation available for your order.' },
//               { icon:'💬',title:'WhatsApp support',sub:'Contact support for order and service questions.' },
//             ].map(t => (
//               <div key={t.title} style={{ background:'#fff',borderRadius:14,border:'1.5px solid #F3F4F6',padding:'16px 18px',display:'flex',gap:12,alignItems:'flex-start' }}>
//                 <span style={{ fontSize:20,flexShrink:0 }}>{t.icon}</span>
//                 <div>
//                   <div style={{ fontWeight:700,fontSize:13,color:'#111827' }}>{t.title}</div>
//                   <div style={{ fontSize:12,color:'#6B7280',marginTop:2,lineHeight:1.45 }}>{t.sub}</div>
//                 </div>
//               </div>
//             ))}
//           </div>

//           {/* ── FAQ ── */}
//           <div style={{ marginTop:64 }}>
//             <div style={{ maxWidth:700 }}>
//               <h2 style={{ margin:'0 0 6px',fontSize:'clamp(1.3rem,3vw,2rem)',fontWeight:900,color:'#111827',letterSpacing:'-0.5px' }}>
//                 Frequently asked questions
//               </h2>
//               <p style={{ margin:'0 0 24px',fontSize:14,color:'#6B7280' }}>Everything you need to know about pricing and delivery.</p>
//               <FaqAccordion faq={faq} />
//             </div>
//           </div>

//           {/* ── Bottom CTA ── */}
//           <div style={{ marginTop:64,borderRadius:22,background:'linear-gradient(135deg,#022C22,#065F46 60%,#0D9B6C)',padding:'48px 40px',position:'relative',overflow:'hidden',textAlign:'center' }}>
//             <div style={{ position:'absolute',inset:0,opacity:0.05,backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)',backgroundSize:'24px 24px',pointerEvents:'none' }} />
//             <div style={{ position:'relative',zIndex:1 }}>
//               <div style={{ fontSize:'clamp(1.5rem,4vw,2.5rem)',fontWeight:900,color:'#fff',letterSpacing:'-0.8px',fontFamily:'Syne, system-ui, sans-serif' }}>
//                 Still deciding?
//               </div>
//               <p style={{ color:'rgba(255,255,255,0.6)',fontSize:15,marginTop:10,marginBottom:28,maxWidth:400,margin:'10px auto 28px' }}>
//                 Order a single 20L can at the current one-time rate. Confirm address availability and the final amount before placing your order.
//               </p>
//               <div style={{ display:'flex',flexWrap:'wrap',gap:12,justifyContent:'center' }}>
//                 <button type="button" onClick={() => router.push('/book?service=water_can')}
//                   style={{ background:'#fff',color:'#065F46',fontWeight:800,fontSize:15,padding:'14px 28px',borderRadius:14,border:'none',cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}>
//                   Order a Can — ₹{NORMAL_RO_PRICE}
//                 </button>
//                 <a href={WHATSAPP} target="_blank" rel="noopener noreferrer"
//                   style={{ background:'rgba(255,255,255,0.12)',color:'#fff',fontWeight:700,fontSize:15,padding:'14px 28px',borderRadius:14,border:'1px solid rgba(255,255,255,0.2)',cursor:'pointer',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:8 }}>
//                   <IconWA /> Chat with us
//                 </a>
//               </div>
//             </div>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

