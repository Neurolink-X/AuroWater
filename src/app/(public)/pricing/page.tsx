// 'use client';

// import React, { useMemo, useState } from 'react';
// import { useRouter } from 'next/navigation';

// type PricingTab = 'individual' | 'business';
// type CanPlan = 'starter' | 'popular' | 'family';
// type BillingCycle = 'monthly' | 'quarterly' | 'annual';
// type FaqItem = { q: string; a: string };

// const WHATSAPP = 'https://wa.me/919889305803';

// // ── Icons ──────────────────────────────────────────────────────────────────
// const WhatsAppIcon = () => (
//   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//     <path d="M20 11.5C20 15.64 16.42 19 12.2 19C10.7 19 9.3 18.61 8.1 17.9L4 19L5.1 15.2C4.45 14 4.1 12.7 4.1 11.5C4.1 7.36 7.68 4 11.9 4C16.12 4 20 7.36 20 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
//     <path d="M9.2 9.4C9.4 9.1 9.7 9 10 9C10.3 9 10.6 9.1 10.7 9.4L11.3 10.7C11.4 10.9 11.4 11.1 11.3 11.3L11 11.7C10.9 11.8 10.9 12 11 12.2C11.3 12.8 11.8 13.4 12.4 13.7C12.6 13.8 12.8 13.8 12.9 13.7L13.3 13.4C13.5 13.3 13.7 13.3 13.9 13.4L15.2 14C15.5 14.1 15.6 14.4 15.6 14.7C15.6 15 15.5 15.3 15.3 15.5C15 15.7 14.7 15.9 14.4 16C14 16.1 13.6 16.1 13.2 16C10.8 15.2 9 13.4 8.2 11C8.1 10.6 8.1 10.2 8.2 9.8C8.3 9.5 8.5 9.2 9.2 9.4Z" fill="currentColor" />
//   </svg>
// );

// const CheckIcon = ({ color = '#0D9B6C' }: { color?: string }) => (
//   <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
//     <circle cx="7" cy="7" r="7" fill={color} opacity="0.12" />
//     <path d="M4 7L6 9L10 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//   </svg>
// );

// const DropSVG = ({ size = 20, color = '#0D9B6C' }: { size?: number; color?: string }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
//     <path d="M12 2C12 2 5 9.5 5 14.5C5 18.09 8.13 21 12 21C15.87 21 19 18.09 19 14.5C19 9.5 12 2 12 2Z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
//     <path d="M9 15.5C9.5 17.5 11 18.5 13 18" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
//   </svg>
// );

// // ── Main Page ──────────────────────────────────────────────────────────────
// export default function PricingPage() {
//   const router = useRouter();
//   const [tab, setTab] = useState<PricingTab>('individual');
//   const [billing, setBilling] = useState<BillingCycle>('monthly');
//   const [openFaq, setOpenFaq] = useState<number | null>(0);
//   const [hoveredPlan, setHoveredPlan] = useState<CanPlan | null>(null);

//   // ── Can subscription plans ────────────────────────────────────────────
//   const canPlans = useMemo(() => {
//     const multiplier = billing === 'monthly' ? 1 : billing === 'quarterly' ? 0.92 : 0.83;
//     const round = (n: number) => Math.round(n);

//     return [
//       {
//         key: 'starter' as CanPlan,
//         name: 'Starter',
//         tagline: 'Just you',
//         cansPerMonth: 10,
//         pricePerCan: round(12 * multiplier),
//         monthlyTotal: round(12 * 10 * multiplier),
//         color: '#0369A1',
//         bgLight: '#EFF6FF',
//         accent: '#BFDBFE',
//         features: [
//           '10 cans / month',
//           '20L BIS-certified water',
//           'Scheduled delivery',
//           'WhatsApp order support',
//           'Pay after delivery',
//         ],
//         popular: false,
//         badge: null as string | null,
//       },
//       {
//         key: 'popular' as CanPlan,
//         name: 'Popular',
//         tagline: 'Family of 4',
//         cansPerMonth: 20,
//         pricePerCan: round(11 * multiplier),
//         monthlyTotal: round(11 * 20 * multiplier),
//         color: '#0D9B6C',
//         bgLight: '#ECFDF5',
//         accent: '#6EE7B7',
//         features: [
//           '20 cans / month',
//           '20L BIS-certified water',
//           'Priority same-day delivery',
//           'Free can sanitization',
//           'Dedicated delivery person',
//           'UPI / Cash / Online',
//         ],
//         popular: true,
//         badge: 'Most Popular' as string | null,
//       },
//       {
//         key: 'family' as CanPlan,
//         name: 'Family+',
//         tagline: 'Large household',
//         cansPerMonth: 30,
//         pricePerCan: round(10 * multiplier),
//         monthlyTotal: round(10 * 30 * multiplier),
//         color: '#7C3AED',
//         bgLight: '#F5F3FF',
//         accent: '#C4B5FD',
//         features: [
//           '30 cans / month',
//           '20L BIS-certified water',
//           'Morning slot guaranteed',
//           'Free can sanitization',
//           'Quarterly taste test report',
//           'Extra cans at ₹10/can',
//           'Monthly GST invoice',
//         ],
//         popular: false,
//         badge: 'Best Value' as string | null,
//       },
//     ];
//   }, [billing]);

//   const savingsLabel: Record<BillingCycle, string | null> = {
//     monthly: null,
//     quarterly: 'Save 8%',
//     annual: 'Save 17%',
//   };

//   const faq: FaqItem[] = useMemo(() => [
//     { q: 'What is the minimum subscription?', a: 'Monthly plan, starting at just 10 cans/month. No lock-in — pause or cancel anytime before the next billing cycle.' },
//     { q: 'What size are the water cans?', a: 'Standard 20-litre BIS-certified sealed cans. Each can goes through a 7-stage purification process before delivery.' },
//     { q: 'Can I order extra cans outside my plan?', a: 'Yes. Extra cans are available at ₹12/can (Starter), ₹11/can (Popular), or ₹10/can (Family+). Just WhatsApp us.' },
//     { q: 'What payment methods are accepted?', a: 'Cash on delivery, UPI (PhonePe, GPay, Paytm), and online banking. GST invoices provided for business accounts.' },
//     { q: 'What is your delivery window?', a: 'We deliver 7 AM–7 PM. Popular and Family+ plans get a morning slot (7–11 AM) priority window.' },
//     { q: 'How do I pause or cancel?', a: 'Send a WhatsApp message before 10 PM the night before your next delivery. No cancellation fee, ever.' },
//     { q: 'Is same-day delivery available?', a: 'Yes, for Popular and Family+ subscribers in covered areas. Order before 2 PM for same-day delivery.' },
//   ], []);

//   const businessTable = [
//     { service: 'Water Cans (20L)', p1: '₹12/can', p2: '₹11/can', p3: '₹10/can', icon: '💧' },
//     { service: 'Water Tanker', p1: '₹299/del', p2: '₹279/del', p3: '₹249/del', icon: '🚛' },
//     { service: 'Plumbing', p1: '₹149/hr', p2: '₹129/hr', p3: 'Custom', icon: '🔧' },
//     { service: 'RO Service', p1: '₹399/visit', p2: '₹349/visit', p3: 'AMC', icon: '⚙️' },
//   ];

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');

//         .pricing-page * { box-sizing: border-box; }
//         .pricing-page { font-family: 'DM Sans', sans-serif; }
//         .pricing-page .syne { font-family: 'Syne', sans-serif; }

//         @keyframes floatDrop {
//           0%, 100% { transform: translateY(0px) rotate(-8deg); }
//           50% { transform: translateY(-10px) rotate(-8deg); }
//         }
//         @keyframes pulseDot {
//           0%, 100% { opacity: 1; box-shadow: 0 0 0 3px rgba(52,211,153,0.25); }
//           50% { opacity: 0.75; box-shadow: 0 0 0 6px rgba(52,211,153,0.08); }
//         }
//         @keyframes fadeUp {
//           from { opacity: 0; transform: translateY(20px); }
//           to { opacity: 1; transform: translateY(0); }
//         }
//         @keyframes priceIn {
//           from { opacity: 0; transform: translateY(6px); }
//           to { opacity: 1; transform: translateY(0); }
//         }

//         .pricing-page .plan-card {
//           transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s ease, border-color 0.2s;
//         }
//         .pricing-page .plan-card:hover { transform: translateY(-6px); }

//         .pricing-page .sec-card {
//           transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
//         }
//         .pricing-page .sec-card:hover { transform: translateY(-3px); }

//         .pricing-page .price-num {
//           display: inline-block;
//           animation: priceIn 0.3s ease both;
//         }

//         .pricing-page .fade-section {
//           animation: fadeUp 0.45s ease both;
//         }
//         .pricing-page .fade-section:nth-child(1) { animation-delay: 0ms; }
//         .pricing-page .fade-section:nth-child(2) { animation-delay: 90ms; }
//         .pricing-page .fade-section:nth-child(3) { animation-delay: 180ms; }

//         .pricing-page .pulse-dot {
//           animation: pulseDot 2.2s ease-in-out infinite;
//         }
//       `}</style>

//       <div className="pricing-page" style={{ minHeight: '100vh', background: '#F8FAFA' }}>

//         {/* ══ HERO ══════════════════════════════════════════════════════ */}
//         <div style={{
//           background: 'linear-gradient(155deg, #011F14 0%, #033D26 50%, #0A5C3A 100%)',
//           padding: 'clamp(52px,8vw,88px) 24px clamp(80px,10vw,110px)',
//           position: 'relative',
//           overflow: 'hidden',
//         }}>
//           {/* background circles */}
//           {[
//             { s: 380, t: -110, r: -90, b: undefined, l: undefined, op: 0.07 },
//             { s: 200, t: undefined, r: undefined, b: -70, l: -50, op: 0.05 },
//             { s: 100, t: 70, r: undefined, b: undefined, l: '42%', op: 0.04 },
//           ].map((c, i) => (
//             <div key={i} style={{
//               position: 'absolute', width: c.s, height: c.s,
//               top: c.t, right: c.r, bottom: c.b, left: c.l as string | number | undefined,
//               borderRadius: '50%', background: '#34D399', opacity: c.op, pointerEvents: 'none',
//             }} />
//           ))}
//           {/* dot grid */}
//           <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none' }} />
//           {/* floating drop */}
//           <div style={{ position: 'absolute', top: 36, right: '7%', animation: 'floatDrop 4.5s ease-in-out infinite', pointerEvents: 'none' }}>
//             <svg width="110" height="132" viewBox="0 0 110 132" fill="none" opacity="0.13">
//               <path d="M55 4C55 4 8 52 8 86C8 113 29 128 55 128C81 128 102 113 102 86C102 52 55 4 55 4Z" fill="#34D399" />
//             </svg>
//           </div>

//           <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
//             {/* pill label */}
//             <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(52,211,153,0.11)', border: '1px solid rgba(52,211,153,0.28)', borderRadius: 999, padding: '5px 14px', marginBottom: 22 }}>
//               <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
//               <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.1em' }}>AURO WATER · TRANSPARENT PRICING</span>
//             </div>

//             <h1 className="syne" style={{ margin: 0, fontSize: 'clamp(2rem,6.5vw,4.2rem)', fontWeight: 900, color: '#fff', letterSpacing: '-2px', lineHeight: 1.05, maxWidth: 680 }}>
//               Pure water at your door.
//               <br />
//               <span style={{ color: '#34D399' }}>Starting ₹10 / can.</span>
//             </h1>
//             <p style={{ margin: '18px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.52)', maxWidth: 460, lineHeight: 1.75 }}>
//               Subscribe and save. No contracts, no surprises — clean 20L cans delivered on your schedule across UP.
//             </p>

//             {/* Stats row */}
//             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginTop: 44, paddingTop: 36, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
//               {[
//                 { v: '₹10–₹12', l: 'Per 20L Can' },
//                 { v: '7 AM–7 PM', l: 'Delivery Window' },
//                 { v: '₹0', l: 'Hidden Charges' },
//                 { v: 'Cancel', l: 'Anytime, Free' },
//               ].map((s) => (
//                 <div key={s.l}>
//                   <div className="syne" style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{s.v}</div>
//                   <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3, fontWeight: 600, letterSpacing: '0.02em' }}>{s.l}</div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* ══ MAIN CONTENT ══════════════════════════════════════════════ */}
//         <div style={{ maxWidth: 1200, margin: '-32px auto 0', padding: '0 24px 80px', position: 'relative', zIndex: 10 }}>

//           {/* Tabs */}
//           <div style={{
//             background: '#fff', borderRadius: 18, border: '1.5px solid #E5E7EB',
//             boxShadow: '0 8px 32px rgba(0,0,0,0.08)', padding: '14px 20px',
//             display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
//             gap: 12, marginBottom: 44,
//           }}>
//             <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
//               {([
//                 { id: 'individual' as PricingTab, label: '🏠 Individual / Family' },
//                 { id: 'business' as PricingTab, label: '🏢 Business / Bulk' },
//               ] as { id: PricingTab; label: string }[]).map((t) => (
//                 <button
//                   key={t.id}
//                   type="button"
//                   onClick={() => setTab(t.id)}
//                   style={{
//                     padding: '9px 20px', borderRadius: 999, fontFamily: 'inherit',
//                     border: tab === t.id ? '1.5px solid #0D9B6C' : '1.5px solid #E5E7EB',
//                     background: tab === t.id ? '#0D9B6C' : '#fff',
//                     color: tab === t.id ? '#fff' : '#6B7280',
//                     fontWeight: 800, fontSize: 13, cursor: 'pointer', transition: 'all 0.18s ease', letterSpacing: '-0.1px',
//                   }}
//                 >{t.label}</button>
//               ))}
//             </div>
//             <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>All prices incl. delivery · Platform fee ₹29/order</span>
//           </div>

//           {tab === 'individual' ? (
//             <>
//               {/* ── CAN SUBSCRIPTIONS (HERO PRODUCT) ── */}
//               <div style={{ marginBottom: 60 }}>
//                 {/* Section header */}
//                 <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 28 }}>
//                   <div>
//                     <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ECFDF5', borderRadius: 999, padding: '4px 12px', marginBottom: 10, border: '1px solid #A7F3D0' }}>
//                       <span style={{ fontSize: 10, fontWeight: 800, color: '#065F46', letterSpacing: '0.1em' }}>★ FLAGSHIP PRODUCT</span>
//                     </div>
//                     <h2 className="syne" style={{ margin: 0, fontSize: 'clamp(1.5rem,4vw,2.4rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-1px', lineHeight: 1.1 }}>
//                       Water Can Subscriptions
//                     </h2>
//                     <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6B7280' }}>20L BIS-certified sealed cans · Choose your monthly volume</p>
//                   </div>

//                   {/* Billing cycle */}
//                   <div style={{ background: '#F3F4F6', borderRadius: 999, padding: 4, display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
//                     {(['monthly', 'quarterly', 'annual'] as BillingCycle[]).map((c) => (
//                       <button
//                         key={c}
//                         type="button"
//                         onClick={() => setBilling(c)}
//                         style={{
//                           padding: '7px 14px', borderRadius: 999, border: 'none',
//                           background: billing === c ? '#fff' : 'transparent',
//                           color: billing === c ? '#0D9B6C' : '#9CA3AF',
//                           fontWeight: billing === c ? 800 : 600, fontSize: 12,
//                           cursor: 'pointer', fontFamily: 'inherit',
//                           boxShadow: billing === c ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
//                           transition: 'all 0.15s', textTransform: 'capitalize' as const,
//                           display: 'flex', alignItems: 'center', gap: 4,
//                         }}
//                       >
//                         {c}
//                         {c === 'quarterly' && <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 800 }}>−8%</span>}
//                         {c === 'annual' && <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 800 }}>−17%</span>}
//                       </button>
//                     ))}
//                   </div>
//                 </div>

//                 {/* Plan cards */}
//                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(285px, 1fr))', gap: 20 }}>
//                   {canPlans.map((plan) => {
//                     const isHovered = hoveredPlan === plan.key;
//                     const isPop = plan.popular;
//                     return (
//                       <div
//                         key={plan.key}
//                         className="plan-card fade-section"
//                         onMouseEnter={() => setHoveredPlan(plan.key)}
//                         onMouseLeave={() => setHoveredPlan(null)}
//                         style={{
//                           background: isPop ? plan.color : '#fff',
//                           borderRadius: 24,
//                           border: isPop ? 'none' : `2px solid ${isHovered ? plan.color : '#F3F4F6'}`,
//                           boxShadow: isPop
//                             ? `0 24px 60px ${plan.color}45`
//                             : isHovered ? `0 20px 50px ${plan.color}22` : '0 2px 12px rgba(0,0,0,0.05)',
//                           overflow: 'hidden',
//                           position: 'relative',
//                           display: 'flex',
//                           flexDirection: 'column',
//                         }}
//                       >
//                         {isPop && <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.55), rgba(255,255,255,0.15))' }} />}

//                         {plan.badge && (
//                           <div style={{ position: 'absolute', top: 18, right: 18 }}>
//                             <span style={{
//                               background: isPop ? 'rgba(255,255,255,0.18)' : plan.bgLight,
//                               color: isPop ? '#fff' : plan.color,
//                               fontSize: 10, fontWeight: 800, padding: '4px 10px',
//                               borderRadius: 999, letterSpacing: '0.06em',
//                               border: isPop ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${plan.accent}`,
//                             }}>{plan.badge}</span>
//                           </div>
//                         )}

//                         <div style={{ padding: '28px 26px', display: 'flex', flexDirection: 'column', flex: 1 }}>
//                           {/* Name */}
//                           <div style={{ marginBottom: 20 }}>
//                             <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
//                               <DropSVG size={22} color={isPop ? 'rgba(255,255,255,0.85)' : plan.color} />
//                               <span className="syne" style={{ fontSize: 19, fontWeight: 900, color: isPop ? '#fff' : '#0F172A', letterSpacing: '-0.4px' }}>{plan.name}</span>
//                             </div>
//                             <span style={{ fontSize: 12, color: isPop ? 'rgba(255,255,255,0.55)' : '#9CA3AF', fontWeight: 500 }}>{plan.tagline}</span>
//                           </div>

//                           {/* Price */}
//                           <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: `1px solid ${isPop ? 'rgba(255,255,255,0.14)' : '#F3F4F6'}` }}>
//                             <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
//                               <span className="syne price-num" style={{ fontSize: 54, fontWeight: 900, color: isPop ? '#fff' : plan.color, letterSpacing: '-3px', lineHeight: 1 }}>
//                                 ₹{plan.pricePerCan}
//                               </span>
//                               <span style={{ fontSize: 13, color: isPop ? 'rgba(255,255,255,0.5)' : '#9CA3AF', marginBottom: 8, fontWeight: 500 }}>/can</span>
//                             </div>
//                             <div style={{ marginTop: 7, fontSize: 13, color: isPop ? 'rgba(255,255,255,0.7)' : '#6B7280', fontWeight: 600 }}>
//                               ≈ ₹{plan.monthlyTotal}/month · {plan.cansPerMonth} cans
//                             </div>
//                             {billing !== 'monthly' && (
//                               <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: isPop ? 'rgba(245,158,11,0.18)' : '#FEF3C7', borderRadius: 999, padding: '3px 9px' }}>
//                                 <span style={{ fontSize: 10, fontWeight: 800, color: isPop ? '#FCD34D' : '#92400E' }}>💰 {savingsLabel[billing]} vs monthly</span>
//                               </div>
//                             )}
//                           </div>

//                           {/* Features */}
//                           <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
//                             {plan.features.map((f) => (
//                               <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: isPop ? 'rgba(255,255,255,0.82)' : '#374151', fontWeight: 500, lineHeight: 1.45 }}>
//                                 <CheckIcon color={isPop ? 'rgba(255,255,255,0.9)' : plan.color} />
//                                 {f}
//                               </li>
//                             ))}
//                           </ul>

//                           {/* CTA */}
//                           <button
//                             type="button"
//                             onClick={() => router.push(`/book?service=water_can&plan=${plan.key}&billing=${billing}`)}
//                             style={{
//                               width: '100%', padding: '14px 0', borderRadius: 14,
//                               background: isPop ? '#fff' : plan.color,
//                               color: isPop ? plan.color : '#fff',
//                               fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer',
//                               fontFamily: 'inherit', letterSpacing: '-0.2px',
//                               boxShadow: isPop ? '0 4px 20px rgba(0,0,0,0.18)' : `0 4px 16px ${plan.color}38`,
//                               transition: 'all 0.2s',
//                             }}
//                             onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.025)'; }}
//                             onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
//                           >
//                             Subscribe — {plan.name}
//                           </button>
//                         </div>
//                       </div>
//                     );
//                   })}
//                 </div>

//                 {/* Extra cans note */}
//                 <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, border: '1.5px solid #F3F4F6', padding: '14px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
//                   <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
//                     <span style={{ fontSize: 16 }}>💡</span>
//                     <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Need extra cans outside your plan?</span>
//                     <span style={{ fontSize: 13, color: '#0D9B6C', fontWeight: 700 }}>Add-on rate: ₹12/can (no subscription needed)</span>
//                   </div>
//                   <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0D9B6C', fontWeight: 700, textDecoration: 'none' }}>
//                     <WhatsAppIcon /> Order via WhatsApp
//                   </a>
//                 </div>
//               </div>

//               {/* ── WHY SUBSCRIBE ── */}
//               <div style={{ marginBottom: 60 }}>
//                 <h2 className="syne" style={{ margin: '0 0 22px', fontSize: 'clamp(1.2rem,3vw,1.8rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.8px' }}>
//                   Why subscribe vs. one-time order?
//                 </h2>
//                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
//                   {[
//                     { icon: '💸', title: 'Save up to 17%', desc: 'Annual subscribers pay as low as ₹10/can. One-time rate is ₹14/can.' },
//                     { icon: '📅', title: 'Never run out', desc: 'Cans arrive on schedule. No need to remember to order each time.' },
//                     { icon: '⚡', title: 'Priority delivery', desc: 'Subscribers get a dedicated slot — no waiting in queue on busy days.' },
//                     { icon: '🔄', title: 'Cancel anytime', desc: 'Pause, skip, or cancel anytime. No lock-in, no penalty, ever.' },
//                   ].map((w) => (
//                     <div
//                       key={w.title}
//                       className="sec-card"
//                       style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #F3F4F6', padding: '20px 22px' }}
//                       onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(13,155,108,0.1)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#A7F3D0'; }}
//                       onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = '#F3F4F6'; }}
//                     >
//                       <div style={{ fontSize: 26, marginBottom: 10 }}>{w.icon}</div>
//                       <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 6 }}>{w.title}</div>
//                       <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.65 }}>{w.desc}</div>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* ── SECONDARY SERVICES ── */}
//               <div style={{ marginBottom: 60 }}>
//                 <div style={{ marginBottom: 22 }}>
//                   <h2 className="syne" style={{ margin: 0, fontSize: 'clamp(1.2rem,3vw,1.8rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.8px' }}>Other Water Services</h2>
//                   <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9CA3AF' }}>One-time bookings · Pay after service</p>
//                 </div>
//                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
//                   {[
//                     { icon: '🚰', name: 'Water Tanker', price: '₹299', unit: '/ delivery', sub: '3000L tanker · Same-day available', service: 'water_tanker', color: '#0369A1' },
//                     { icon: '🔧', name: 'Plumber Booking', price: '₹149', unit: '/ hr', sub: 'Verified & rated · Pay after service', service: 'plumbing', color: '#D97706' },
//                     { icon: '⚙️', name: 'RO Service', price: '₹399', unit: '/ visit', sub: 'Filter change + membrane check', service: 'ro_service', color: '#7C3AED' },
//                     { icon: '⛏️', name: 'Borewell', price: '₹799', unit: '/ visit', sub: 'Drilling, repair & motor fix', service: 'borewell', color: '#B45309' },
//                   ].map((s) => (
//                     <div
//                       key={s.name}
//                       className="sec-card"
//                       style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #F3F4F6', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}
//                       onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = s.color; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 28px ${s.color}18`; }}
//                       onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#F3F4F6'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
//                     >
//                       <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
//                         <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//                           <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{s.icon}</div>
//                           <div>
//                             <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', letterSpacing: '-0.2px' }}>{s.name}</div>
//                             <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.sub}</div>
//                           </div>
//                         </div>
//                         <div style={{ textAlign: 'right', flexShrink: 0 }}>
//                           <div className="syne" style={{ fontSize: 22, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.price}</div>
//                           <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{s.unit}</div>
//                         </div>
//                       </div>
//                       <button
//                         type="button"
//                         onClick={() => router.push(`/book?service=${s.service}`)}
//                         style={{ width: '100%', padding: '10px', borderRadius: 10, background: `${s.color}10`, border: `1.5px solid ${s.color}28`, color: s.color, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
//                         onMouseEnter={(e) => { e.currentTarget.style.background = s.color; e.currentTarget.style.color = '#fff'; }}
//                         onMouseLeave={(e) => { e.currentTarget.style.background = `${s.color}10`; e.currentTarget.style.color = s.color; }}
//                       >
//                         Book Now
//                       </button>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* ── AMC BANNER ── */}
//               <div style={{
//                 borderRadius: 22,
//                 background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
//                 padding: 'clamp(28px,4vw,40px) clamp(24px,5vw,40px)',
//                 marginBottom: 60,
//                 position: 'relative', overflow: 'hidden',
//                 display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20,
//               }}>
//                 <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: '#38BDF8', opacity: 0.07, pointerEvents: 'none' }} />
//                 <div style={{ position: 'relative', zIndex: 1 }}>
//                   <span style={{ fontSize: 10, fontWeight: 800, color: '#38BDF8', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>Annual Maintenance Contract</span>
//                   <h2 className="syne" style={{ margin: '6px 0 10px', fontSize: 'clamp(1.1rem,2.5vw,1.6rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
//                     Full-year peace of mind — ₹4,999
//                   </h2>
//                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
//                     {['6 service visits', 'Priority booking', 'Free filter change', 'Annual water report'].map((f) => (
//                       <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
//                         <CheckIcon color="#38BDF8" /> {f}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//                 <button
//                   type="button"
//                   onClick={() => router.push('/contact')}
//                   style={{ background: '#38BDF8', color: '#0C2340', fontWeight: 800, fontSize: 14, padding: '13px 26px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const, boxShadow: '0 4px 16px rgba(56,189,248,0.38)', transition: 'all 0.2s', position: 'relative', zIndex: 1 }}
//                   onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
//                   onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
//                 >
//                   Get AMC →
//                 </button>
//               </div>
//             </>
//           ) : (
//             /* ══ BUSINESS TAB ══════════════════════════════════════════ */
//             <div style={{ marginBottom: 56 }}>
//               <div style={{ marginBottom: 26 }}>
//                 <h2 className="syne" style={{ margin: 0, fontSize: 'clamp(1.5rem,4vw,2rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-1px' }}>Bulk & Business Pricing</h2>
//                 <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6B7280' }}>Volume discounts confirmed via WhatsApp · GST invoices available</p>
//               </div>

//               <div style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 22 }}>
//                 <div style={{ background: '#0F172A', padding: '15px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
//                   {['Service', '1–10 orders', '11–50 orders', '50+ orders'].map((h) => (
//                     <div key={h} style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>{h}</div>
//                   ))}
//                 </div>
//                 {businessTable.map((row, i) => (
//                   <div
//                     key={row.service}
//                     style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, padding: '18px 24px', borderBottom: i < businessTable.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', transition: 'background 0.15s', cursor: 'default' }}
//                     onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
//                     onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
//                   >
//                     <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//                       <span style={{ fontSize: 18 }}>{row.icon}</span>
//                       <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{row.service}</span>
//                     </div>
//                     <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{row.p1}</span>
//                     <span style={{ fontSize: 14, fontWeight: 600, color: '#059669' }}>{row.p2}</span>
//                     <span style={{ fontSize: 14, fontWeight: 800, color: '#0D9B6C' }}>{row.p3}</span>
//                   </div>
//                 ))}
//               </div>

//               <div style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', borderRadius: 18, border: '1.5px solid #A7F3D0', padding: '24px 28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
//                 <div>
//                   <div style={{ fontSize: 16, fontWeight: 800, color: '#065F46' }}>Get a custom business quote</div>
//                   <div style={{ fontSize: 13, color: '#047857', marginTop: 4 }}>Dedicated account manager · GST invoice · Multiple delivery addresses</div>
//                 </div>
//                 <a
//                   href={WHATSAPP} target="_blank" rel="noopener noreferrer"
//                   style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0D9B6C', color: '#fff', fontWeight: 800, fontSize: 14, padding: '12px 22px', borderRadius: 12, textDecoration: 'none', boxShadow: '0 4px 14px rgba(13,155,108,0.33)', transition: 'all 0.2s' }}
//                   onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
//                   onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
//                 >
//                   <WhatsAppIcon /> WhatsApp for Quote
//                 </a>
//               </div>
//             </div>
//           )}

//           {/* ══ FAQ ══════════════════════════════════════════════════════ */}
//           <div style={{ maxWidth: 720, marginBottom: 56 }}>
//             <h2 className="syne" style={{ margin: '0 0 6px', fontSize: 'clamp(1.2rem,3vw,1.8rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.8px' }}>Common Questions</h2>
//             <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 24px' }}>Everything you need to know about our pricing and delivery.</p>
//             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
//               {faq.map((item, idx) => {
//                 const open = openFaq === idx;
//                 return (
//                   <div
//                     key={item.q}
//                     style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${open ? '#0D9B6C' : '#F3F4F6'}`, overflow: 'hidden', boxShadow: open ? '0 4px 16px rgba(13,155,108,0.08)' : 'none', transition: 'all 0.2s' }}
//                   >
//                     <button
//                       type="button"
//                       onClick={() => setOpenFaq((c) => c === idx ? null : idx)}
//                       style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}
//                     >
//                       <span style={{ fontWeight: 700, fontSize: 14, color: '#111827', lineHeight: 1.4 }}>{item.q}</span>
//                       <div style={{ width: 24, height: 24, borderRadius: '50%', background: open ? '#0D9B6C' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
//                         <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
//                           <path d={open ? 'M2 5h6' : 'M5 2v6M2 5h6'} stroke={open ? '#fff' : '#9CA3AF'} strokeWidth="1.5" strokeLinecap="round" />
//                         </svg>
//                       </div>
//                     </button>
//                     {open && (
//                       <div style={{ padding: '0 20px 16px', fontSize: 13, color: '#6B7280', lineHeight: 1.75, borderTop: '1px solid #F3F4F6' }}>
//                         <div style={{ paddingTop: 12 }}>{item.a}</div>
//                       </div>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           </div>

//           {/* ══ FINAL CTA ════════════════════════════════════════════════ */}
//           <div style={{
//             borderRadius: 24, overflow: 'hidden',
//             background: 'linear-gradient(135deg, #022C22 0%, #065F46 60%, #0D9B6C 100%)',
//             padding: 'clamp(40px,6vw,64px) clamp(28px,5vw,48px)',
//             textAlign: 'center', position: 'relative',
//           }}>
//             <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
//             <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: '#34D399', opacity: 0.09, pointerEvents: 'none' }} />
//             <div style={{ position: 'relative', zIndex: 1 }}>
//               <DropSVG size={38} color="#34D399" />
//               <h2 className="syne" style={{ margin: '14px 0 10px', fontSize: 'clamp(1.5rem,4vw,2.4rem)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>
//                 Ready for clean water, every day?
//               </h2>
//               <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, margin: '0 0 30px', lineHeight: 1.7 }}>
//                 Start with 10 cans/month at just ₹12/can. Cancel anytime — no fine print.
//               </p>
//               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
//                 <button
//                   type="button"
//                   onClick={() => router.push('/book?service=water_can&plan=popular')}
//                   style={{ background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 15, padding: '14px 32px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(0,0,0,0.18)', transition: 'all 0.2s', letterSpacing: '-0.2px' }}
//                   onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.22)'; }}
//                   onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.18)'; }}
//                 >
//                   Subscribe Now →
//                 </button>
//                 <a
//                   href={WHATSAPP} target="_blank" rel="noopener noreferrer"
//                   style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '14px 24px', borderRadius: 14, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.2)', transition: 'all 0.2s' }}
//                   onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.18)'; }}
//                   onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.1)'; }}
//                 >
//                   <WhatsAppIcon /> Ask on WhatsApp
//                 </a>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }













'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type PricingTab = 'individual' | 'business';
type BillingCycle = 'monthly' | 'yearly';
type FaqItem = { q: string; a: string };

const WHATSAPP = 'https://wa.me/919889305803';

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7.5" cy="7.5" r="7" fill="#DCFCE7" />
      <path d="M4.5 7.5L6.5 9.5L10.5 5.5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconX() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7.5" cy="7.5" r="7" fill="#F3F4F6" />
      <path d="M5.5 9.5L9.5 5.5M9.5 9.5L5.5 5.5" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconWA() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M20 11.5C20 15.64 16.42 19 12.2 19C10.7 19 9.3 18.61 8.1 17.9L4 19L5.1 15.2C4.45 14 4.1 12.7 4.1 11.5C4.1 7.36 7.68 4 11.9 4C16.12 4 20 7.36 20 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.2 9.4C9.4 9.1 9.7 9 10 9C10.3 9 10.6 9.1 10.7 9.4L11.3 10.7C11.4 10.9 11.4 11.1 11.3 11.3L11 11.7C10.9 11.8 10.9 12 11 12.2C11.3 12.8 11.8 13.4 12.4 13.7C12.6 13.8 12.8 13.8 12.9 13.7L13.3 13.4C13.5 13.3 13.7 13.3 13.9 13.4L15.2 14C15.5 14.1 15.6 14.4 15.6 14.7C15.6 15 15.5 15.3 15.3 15.5C15 15.7 14.7 15.9 14.4 16C14 16.1 13.6 16.1 13.2 16C10.8 15.2 9 13.4 8.2 11C8.1 10.6 8.1 10.2 8.2 9.8C8.3 9.5 8.5 9.2 9.2 9.4Z" fill="currentColor" opacity="0.95" />
    </svg>
  );
}
function IconDroplet() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 3C11 3 5 9.5 5 13.5C5 16.538 7.686 19 11 19C14.314 19 17 16.538 17 13.5C17 9.5 11 3 11 3Z" fill="url(#drop)" stroke="#0369A1" strokeWidth="1.2" />
      <path d="M8.5 14.5C8.5 16 9.5 17 11 17" stroke="#BAE6FD" strokeWidth="1.3" strokeLinecap="round" />
      <defs>
        <linearGradient id="drop" x1="11" y1="3" x2="11" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Pill tag ─────────────────────────────────────────────────────────────────
function Pill({ children, color = 'green' }: { children: React.ReactNode; color?: 'green' | 'blue' | 'amber' | 'slate' }) {
  const map = {
    green: { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
    blue:  { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    amber: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
    slate: { bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
  };
  const s = map[color];
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '3px 10px', letterSpacing: '0.04em', display: 'inline-block' }}>
      {children}
    </span>
  );
}

// ─── Can savings calculator ───────────────────────────────────────────────────
function SavingsCalc() {
  const [cans, setCans] = useState(20);
  const retail = 20;
  const ourPrice = 12;
  const saving = (retail - ourPrice) * cans;
  const yearly = saving * 12;

  return (
    <div style={{ background: 'linear-gradient(135deg,#0C4A6E,#0369A1)', borderRadius: 20, padding: '28px 28px 24px', color: '#fff', marginTop: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#7DD3FC', marginBottom: 6 }}>SAVINGS CALCULATOR</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#E0F2FE', marginBottom: 16 }}>
        How much do you spend on water cans?
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <input
          type="range" min={5} max={100} step={1} value={cans}
          onChange={e => setCans(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#38BDF8', height: 4 }}
        />
        <div style={{ minWidth: 80, textAlign: 'right' }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#38BDF8' }}>{cans}</span>
          <span style={{ fontSize: 13, color: '#7DD3FC', marginLeft: 4 }}>cans/mo</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#7DD3FC', fontWeight: 600, marginBottom: 4 }}>Market price</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#FCA5A5' }}>₹{retail * cans}<span style={{ fontSize: 12, fontWeight: 500 }}>/mo</span></div>
        </div>
        <div style={{ background: 'rgba(56,189,248,0.15)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(56,189,248,0.3)' }}>
          <div style={{ fontSize: 11, color: '#7DD3FC', fontWeight: 600, marginBottom: 4 }}>With AuroWater</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#38BDF8' }}>₹{ourPrice * cans}<span style={{ fontSize: 12, fontWeight: 500 }}>/mo</span></div>
        </div>
      </div>
      <div style={{ marginTop: 14, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#6EE7B7', fontWeight: 600 }}>You save yearly</span>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#34D399' }}>₹{yearly.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Subscription card ────────────────────────────────────────────────────────
type SubPlan = {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  badgeColor?: 'green' | 'blue' | 'amber';
  priceMonthly: number;
  priceYearly: number;
  cansPerMonth: number | string;
  perCan: string;
  features: { text: string; included: boolean }[];
  cta: string;
  ctaVariant: 'primary' | 'outline' | 'dark';
  highlight?: boolean;
};

function SubCard({ plan, cycle, onCta }: { plan: SubPlan; cycle: BillingCycle; onCta: () => void }) {
  const [hovered, setHovered] = useState(false);
  const price = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const yearlySave = plan.priceMonthly > 0
    ? Math.round(((plan.priceMonthly - plan.priceYearly) / plan.priceMonthly) * 100)
    : 0;

  const ctaStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg,#0D9B6C,#059652)',
      color: '#fff',
      border: 'none',
      boxShadow: hovered ? '0 8px 24px rgba(13,155,108,0.45)' : '0 4px 14px rgba(13,155,108,0.3)',
    },
    outline: {
      background: hovered ? 'rgba(13,155,108,0.06)' : 'transparent',
      color: '#0D9B6C',
      border: '2px solid #0D9B6C',
    },
    dark: {
      background: hovered ? '#1E293B' : '#0F172A',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.12)',
    },
  };

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: 22,
        background: plan.highlight ? 'linear-gradient(160deg,#022C22,#065F46)' : '#fff',
        border: plan.highlight ? '2px solid #0D9B6C' : `1.5px solid ${hovered ? '#0D9B6C' : '#E5E7EB'}`,
        boxShadow: plan.highlight
          ? '0 20px 60px rgba(13,155,108,0.25)'
          : hovered ? '0 12px 40px rgba(0,0,0,0.1)' : '0 2px 12px rgba(0,0,0,0.05)',
        transform: hovered && !plan.highlight ? 'translateY(-4px)' : 'none',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* top bar */}
      <div style={{
        height: 5,
        background: plan.highlight
          ? 'linear-gradient(90deg,#34D399,#0D9B6C)'
          : plan.id === 'pay-per-can' ? 'linear-gradient(90deg,#38BDF8,#0369A1)'
          : plan.id === 'business' ? 'linear-gradient(90deg,#F59E0B,#D97706)'
          : '#E5E7EB',
      }} />

      {plan.badge && (
        <div style={{ position: 'absolute', top: 18, right: 18 }}>
          <Pill color={plan.badgeColor ?? 'green'}>{plan.badge}</Pill>
        </div>
      )}

      <div style={{ padding: '24px 26px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: plan.highlight ? '#fff' : '#111827', letterSpacing: '-0.3px' }}>
            {plan.name}
          </div>
          <div style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#6B7280', marginTop: 3, fontWeight: 500 }}>
            {plan.tagline}
          </div>
        </div>

        {/* price */}
        <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${plan.highlight ? 'rgba(255,255,255,0.12)' : '#F3F4F6'}` }}>
          {typeof plan.priceMonthly === 'number' && plan.priceMonthly > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', color: plan.highlight ? '#34D399' : '#111827', lineHeight: 1 }}>
                ₹{price}
              </span>
              <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.5)' : '#9CA3AF', marginBottom: 4, fontWeight: 500 }}>
                /month
              </span>
              {cycle === 'yearly' && yearlySave > 0 && (
                <span style={{ marginBottom: 4 }}><Pill color="green">Save {yearlySave}%</Pill></span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 32, fontWeight: 900, color: plan.highlight ? '#34D399' : '#111827', letterSpacing: '-1px' }}>Custom</div>
          )}
          <div style={{ marginTop: 6, fontSize: 13, color: plan.highlight ? '#6EE7B7' : '#059669', fontWeight: 700 }}>
            {plan.perCan}
          </div>
          {typeof plan.cansPerMonth === 'number' && (
            <div style={{ marginTop: 3, fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}>
              Up to {plan.cansPerMonth} cans/month included
            </div>
          )}
        </div>

        {/* features */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {plan.features.map((f) => (
            <li key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              {f.included ? <IconCheck /> : <IconX />}
              <span style={{ fontSize: 13, fontWeight: 500, color: plan.highlight ? (f.included ? '#D1FAE5' : 'rgba(255,255,255,0.35)') : (f.included ? '#374151' : '#9CA3AF'), lineHeight: 1.4 }}>
                {f.text}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          onClick={onCta}
          style={{
            marginTop: 24,
            width: '100%',
            padding: '13px 0',
            borderRadius: 13,
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            letterSpacing: '-0.2px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            ...ctaStyles[plan.ctaVariant],
          }}
        >
          {plan.cta}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </article>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function FaqAccordion({ faq }: { faq: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {faq.map((item, idx) => {
        const isOpen = open === idx;
        return (
          <div key={item.q} style={{ borderRadius: 14, border: `1.5px solid ${isOpen ? '#0D9B6C' : '#E5E7EB'}`, background: isOpen ? '#F0FDF4' : '#fff', overflow: 'hidden', transition: 'all 0.2s' }}>
            <button
              type="button"
              onClick={() => setOpen(cur => cur === idx ? null : idx)}
              style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{item.q}</span>
              <span style={{ fontSize: 18, color: '#0D9B6C', fontWeight: 700, flexShrink: 0, transform: isOpen ? 'rotate(45deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>+</span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 20px 16px', fontSize: 13, color: '#4B5563', lineHeight: 1.65 }}>{item.a}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Compare table ────────────────────────────────────────────────────────────
function CompareTable() {
  const rows = [
    { feature: 'Price per can', payg: '₹10–12', starter: '₹12', pro: '₹11', business: '₹9–10' },
    { feature: 'Min. order', payg: '1 can', starter: '10 cans', pro: '20 cans', business: 'Custom' },
    { feature: 'Same-day delivery', payg: '✓', starter: '✓', pro: 'Priority', business: 'Dedicated' },
    { feature: 'Subscription discount', payg: '—', starter: '10%', pro: '20%', business: '30%+' },
    { feature: 'Scheduled deliveries', payg: '—', starter: '✓', pro: '✓', business: '✓' },
    { feature: 'GST invoice', payg: '—', starter: '—', pro: '✓', business: '✓' },
    { feature: 'Dedicated manager', payg: '—', starter: '—', pro: '—', business: '✓' },
  ];
  const cols = ['Feature', 'Pay-as-go', 'Starter', 'Pro', 'Business'];

  return (
    <div style={{ overflowX: 'auto', borderRadius: 18, border: '1.5px solid #E5E7EB', background: '#fff' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
        <thead>
          <tr style={{ background: '#F9FAFB' }}>
            {cols.map((c, i) => (
              <th key={c} style={{
                padding: '14px 18px',
                textAlign: i === 0 ? 'left' : 'center',
                fontWeight: 700,
                color: i === 2 ? '#065F46' : '#374151',
                fontSize: 12,
                letterSpacing: '0.04em',
                borderBottom: '1.5px solid #E5E7EB',
                background: i === 2 ? '#ECFDF5' : undefined,
              }}>
                {c}{i === 2 ? ' ⭐' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.feature} style={{ background: ri % 2 === 0 ? '#fff' : '#F9FAFB' }}>
              <td style={{ padding: '13px 18px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #F3F4F6' }}>{row.feature}</td>
              {[row.payg, row.starter, row.pro, row.business].map((val, ci) => (
                <td key={ci} style={{
                  padding: '13px 18px',
                  textAlign: 'center',
                  color: ci === 1 ? '#065F46' : val === '—' ? '#D1D5DB' : '#374151',
                  fontWeight: ci === 1 ? 700 : 500,
                  borderBottom: '1px solid #F3F4F6',
                  background: ci === 1 ? 'rgba(236,253,245,0.4)' : undefined,
                }}>
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<PricingTab>('individual');
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [showCompare, setShowCompare] = useState(false);

  const faq: FaqItem[] = useMemo(() => [
    { q: 'What is the minimum order for can delivery?', a: 'For pay-as-you-go, you can order just 1 can at ₹10–12. Subscription plans start with 10 cans/month and unlock lower per-can rates down to ₹12.' },
    { q: 'How does the subscription work?', a: 'Choose a plan, set your monthly can count, and we deliver on your preferred schedule — daily, alternate days, or weekly. Pause or cancel anytime.' },
    { q: 'Can I mix can delivery and other services?', a: 'Yes! Book tanker delivery, RO service, or plumbing alongside your can subscription — all from one account.' },
    { q: 'What payment methods are accepted?', a: 'Cash on delivery, UPI, and card. Business plans support credit terms and monthly GST invoices.' },
    { q: 'Is there a free cancellation policy?', a: 'Cancel same-day deliveries up to 2 hours before the scheduled slot. Subscriptions can be paused any time.' },
    { q: 'Do you offer GST invoices for business?', a: 'Yes — Pro and Business plans include monthly GST invoices. GSTIN registration required.' },
    { q: 'What is same-day service availability?', a: 'Same-day can delivery is available in Lucknow, Kanpur, Noida, Ghaziabad, Agra, Varanasi, Gorakhpur, and Prayagraj before 4 PM.' },
    { q: 'Can I change my subscription plan?', a: 'Upgrade or downgrade at any time — changes apply from your next billing cycle.' },
  ], []);

  const individualPlans: SubPlan[] = [
    {
      id: 'pay-per-can',
      name: 'Pay-as-you-go',
      tagline: 'No commitment. Order when needed.',
      priceMonthly: 0,
      priceYearly: 0,
      cansPerMonth: 'No minimum',
      perCan: '₹10–12 per 20L can',
      features: [
        { text: '20L water can delivery', included: true },
        { text: 'Same-day delivery (before 4 PM)', included: true },
        { text: 'Pay on delivery (Cash/UPI)', included: true },
        { text: 'Track delivery in real-time', included: true },
        { text: 'Subscription discount', included: false },
        { text: 'Scheduled repeat deliveries', included: false },
        { text: 'Priority support', included: false },
      ],
      cta: 'Order a Can',
      ctaVariant: 'outline',
    },
    {
      id: 'starter',
      name: 'Starter',
      tagline: 'Best for families. Save every month.',
      badge: 'Most Popular',
      badgeColor: 'green',
      priceMonthly: 299,
      priceYearly: 249,
      cansPerMonth: 30,
      perCan: '₹12 per can — save ₹3/can vs market',
      features: [
        { text: 'Up to 30 cans/month @ ₹12/can', included: true },
        { text: 'Flexible delivery schedule', included: true },
        { text: 'Same-day & next-day delivery', included: true },
        { text: 'Pay on delivery (Cash/UPI)', included: true },
        { text: '10% off all other services', included: true },
        { text: 'Pause or cancel anytime', included: true },
        { text: 'Priority support', included: false },
      ],
      cta: 'Start Starter Plan',
      ctaVariant: 'primary',
      highlight: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      tagline: 'Larger families & small offices.',
      badge: 'Best Value',
      badgeColor: 'blue',
      priceMonthly: 549,
      priceYearly: 449,
      cansPerMonth: 60,
      perCan: '₹11 per can — 45% below market',
      features: [
        { text: 'Up to 60 cans/month @ ₹11/can', included: true },
        { text: 'Priority same-day delivery', included: true },
        { text: 'RO service & tank cleaning included once', included: true },
        { text: '20% off all other services', included: true },
        { text: 'Monthly GST invoice', included: true },
        { text: 'Priority support + WhatsApp line', included: true },
        { text: 'Dedicated account manager', included: false },
      ],
      cta: 'Start Pro Plan',
      ctaVariant: 'outline',
    },
  ];

  const businessPlans: SubPlan[] = [
    {
      id: 'office',
      name: 'Office',
      tagline: 'Offices, clinics & small teams.',
      badge: 'Popular',
      badgeColor: 'amber',
      priceMonthly: 999,
      priceYearly: 849,
      cansPerMonth: 120,
      perCan: '₹10 per can',
      features: [
        { text: 'Up to 120 cans/month @ ₹10/can', included: true },
        { text: 'Scheduled bulk deliveries', included: true },
        { text: 'Monthly GST invoice', included: true },
        { text: '20% off plumbing & motor repair', included: true },
        { text: 'Priority delivery slot', included: true },
        { text: 'Dedicated account manager', included: false },
        { text: 'Custom billing terms', included: false },
      ],
      cta: 'Get Office Plan',
      ctaVariant: 'outline',
    },
    {
      id: 'business',
      name: 'Business',
      tagline: 'Apartments, restaurants & large teams.',
      badge: 'Enterprise',
      badgeColor: 'green',
      priceMonthly: 0,
      priceYearly: 0,
      cansPerMonth: 'Unlimited',
      perCan: '₹9–10 per can, volume-tiered',
      features: [
        { text: 'Unlimited cans @ ₹9–10/can', included: true },
        { text: 'Multiple delivery addresses', included: true },
        { text: 'Dedicated account manager', included: true },
        { text: 'Custom billing & credit terms', included: true },
        { text: 'Monthly GST invoice + reports', included: true },
        { text: 'Free annual water quality test', included: true },
        { text: 'Tanker + RO + plumbing bundle', included: true },
      ],
      cta: 'Get Custom Quote',
      ctaVariant: 'dark',
      highlight: true,
    },
  ];

  const activePlans = tab === 'individual' ? individualPlans : businessPlans;

  const handlePlanCta = (plan: SubPlan) => {
    if (plan.id === 'business' || plan.id === 'pay-per-can') {
      if (plan.id === 'business') window.open(WHATSAPP, '_blank');
      else router.push('/book?service=water_can');
    } else {
      router.push(`/book?service=water_can&plan=${plan.id}&billing=${billing}`);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .pricing-page * { box-sizing: border-box; font-family: 'DM Sans', sans-serif; }
        .pricing-page h1, .pricing-page h2, .pricing-page .display { font-family: 'Syne', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,0.2);} 50%{box-shadow:0 0 0 7px rgba(16,185,129,0.06);} }
        .pricing-page .plan-card { animation: fadeUp 0.5s ease both; }
        .pricing-page .plan-card:nth-child(1){animation-delay:0ms}
        .pricing-page .plan-card:nth-child(2){animation-delay:80ms}
        .pricing-page .plan-card:nth-child(3){animation-delay:160ms}
        .pricing-page input[type=range]::-webkit-slider-thumb { width:18px;height:18px;border-radius:50%;background:#38BDF8;cursor:pointer;-webkit-appearance:none; }
        .pricing-page input[type=range]::-webkit-slider-runnable-track { height:4px;border-radius:4px;background:rgba(255,255,255,0.2); }
        .pricing-page .billing-toggle button { transition: all 0.2s; }
      `}</style>

      <div className="pricing-page" style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#F0FDF8 0%,#F8FAFC 50%,#fff 100%)' }}>

        {/* ── HERO ── */}
        <div style={{ background: 'linear-gradient(135deg,#022C22 0%,#064E3B 55%,#0D9B6C 100%)', padding: '68px 24px 100px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position:'absolute',inset:0,opacity:0.06,backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)',backgroundSize:'28px 28px',pointerEvents:'none' }} />
          <div style={{ position:'absolute',top:-100,right:-80,width:360,height:360,borderRadius:'50%',background:'#34D399',opacity:0.07,pointerEvents:'none' }} />
          <div style={{ position:'absolute',bottom:-60,left:-60,width:240,height:240,borderRadius:'50%',background:'#0D9B6C',opacity:0.06,pointerEvents:'none' }} />

          <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {/* trust pill */}
            <div style={{ display:'inline-flex',alignItems:'center',gap:8,background:'rgba(52,211,153,0.15)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:999,padding:'6px 14px',marginBottom:20 }}>
              <span style={{ width:7,height:7,borderRadius:'50%',background:'#34D399',display:'inline-block',animation:'pulse 2s infinite' }} />
              <span style={{ fontSize:12,fontWeight:700,color:'#6EE7B7',letterSpacing:'0.07em' }}>DELIVERING ACROSS 13 CITIES IN UP</span>
            </div>

           {/* Eyebrow pill */}
<div style={{
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '5px 14px', borderRadius: 999,
  border: '1px solid rgba(52,211,153,0.3)',
  marginBottom: 20,
}}>
  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
  <span style={{ fontSize: 11, fontWeight: 600, color: '#6ee7b7', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
    Delivering across 13 cities in UP
  </span>
</div>

{/* Main headline — ALL IN ONE H1 */}
<h1 className="syne" style={{
  margin: '0 0 20px',
  fontWeight: 900,
  lineHeight: 1.0,           // ← NOT 0.93 — that only works for display posters
  letterSpacing: '-1.5px',   // ← NOT -3px — that's only for 80px+ sizes
  maxWidth: 640,
}}>
  <span style={{ display: 'block', fontSize: 'clamp(2rem, 3.8vw, 3.6rem)', color: '#fff' }}>
    Pure water at your door.
  </span>
  <span style={{ display: 'block', fontSize: 'clamp(2rem, 3.8vw, 3.6rem)', color: '#34D399' }}>
    Starting ₹10 / can.
  </span>

  {/* visual divider inside h1 */}
  <span style={{ display: 'block', height: 1, background: 'rgba(255,255,255,0.1)', maxWidth: 360, margin: '18px 0' }} />

  <span style={{ display: 'block', fontSize: 'clamp(1.5rem, 2.8vw, 2.6rem)', color: '#fff', letterSpacing: '-1px' }}>
    Clean Water at{' '}
    <span style={{ color: '#34D399' }}>₹12 / Can.</span>{' '}
    <span style={{ color: 'rgba(255,255,255,0.38)' }}>Not ₹20.</span>
  </span>
</h1>
            <p style={{ margin:'18px 0 0',fontSize:17,color:'rgba(255,255,255,0.65)',maxWidth:480,lineHeight:1.65 }}>
              India's most transparent water service pricing. No hidden charges, no surprise bills — just safe, affordable water delivered to your door.
            </p>

            {/* hero value props */}
            <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginTop:28 }}>
              {['₹12/can on subscription','Free same-day delivery','Pause anytime','GST invoice available'].map(t => (
                <div key={t} style={{ display:'flex',alignItems:'center',gap:7,background:'rgba(255,255,255,0.09)',borderRadius:999,padding:'7px 14px',border:'1px solid rgba(255,255,255,0.12)' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#34D399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize:13,color:'rgba(255,255,255,0.85)',fontWeight:600 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CAN HIGHLIGHT BAND ── */}
       {/* ═══════════════════════════════════════════════════════════════
    PRICING CARD BLOCK — paste directly inside your page's return()
    Requires: router from useRouter() already declared in parent
    Requires: Google Fonts (Syne + DM Sans) in your layout or _document
    ═══════════════════════════════════════════════════════════════ */}

{/* ── Styles ── */}
<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

  .pc-root {
    max-width: 1160px;
    margin: -40px auto 0;
    padding: 0 24px;
    position: relative;
    z-index: 10;
  }
  .pc-card {
    background: #fff;
    border-radius: 22px;
    border: 1px solid #E2EDE9;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05), 0 24px 56px rgba(13,155,108,0.08);
    overflow: hidden;
    font-family: 'DM Sans', sans-serif;
  }
  .pc-accent-bar {
    height: 3px;
    background: linear-gradient(90deg, #0D9B6C 0%, #34D399 50%, #0D9B6C 100%);
  }
  .pc-grid {
    display: grid;
    grid-template-columns: auto 1px 1fr;
    align-items: stretch;
  }
  .pc-left {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px 28px;
  }
  .pc-icon {
    width: 52px; height: 52px;
    border-radius: 15px;
    background: #F0FDF9;
    border: 1px solid #D1FAE5;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .pc-label {
    font-size: 10px; font-weight: 700; color: #6B7280;
    letter-spacing: 0.1em; text-transform: uppercase;
  }
  .pc-badge {
    font-size: 9px; font-weight: 700; color: #065F46;
    background: #ECFDF5; border: 1px solid #A7F3D0;
    padding: 2px 7px; border-radius: 99px;
    letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;
  }
  .pc-price-main {
    font-family: 'Syne', sans-serif; font-weight: 900;
    font-size: 30px; color: #0F1C18;
    letter-spacing: -1.5px; line-height: 1;
  }
  .pc-save-pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: #FEF9C3; border: 1px solid #FDE047;
    padding: 3px 8px; border-radius: 6px;
    font-size: 11px; font-weight: 700; color: #78350F;
  }
  .pc-vdivider {
    width: 1px; align-self: stretch;
    background: linear-gradient(to bottom, transparent 10%, #E5E7EB 40%, #E5E7EB 60%, transparent 90%);
  }
  .pc-right {
    display: flex; flex-direction: column;
    justify-content: center; gap: 16px;
    padding: 22px 24px 22px 28px;
  }
  .pc-tiers { display: flex; gap: 10px; flex-wrap: nowrap; }
  .pc-tier {
    border-radius: 13px; padding: 12px 16px; cursor: pointer;
    position: relative; flex: 0 0 auto; width: 130px;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }
  .pc-tier:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.09); }
  .pc-tier-label {
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px;
  }
  .pc-tier-price {
    font-family: 'Syne', sans-serif; font-weight: 900;
    font-size: 18px; letter-spacing: -0.5px; line-height: 1.1;
  }
  .pc-tier-sub { font-size: 10px; font-weight: 500; margin-top: 2px; }
  .pc-best-pin {
    position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
    background: #0D9B6C; color: #fff;
    font-size: 8px; font-weight: 700; letter-spacing: 0.08em;
    padding: 2px 8px 3px; border-radius: 99px;
    text-transform: uppercase; white-space: nowrap;
  }
  .pc-cta-row { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; }
  .pc-cta-btn {
    background: #0D9B6C; color: #fff;
    font-family: 'DM Sans', sans-serif; font-weight: 700;
    font-size: 14px; letter-spacing: -0.2px;
    padding: 13px 24px; border-radius: 13px; border: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    white-space: nowrap; flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(13,155,108,0.30);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }
  .pc-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(13,155,108,0.40); }
  .pc-cta-btn:active { transform: scale(0.97); }
  .pc-cta-arrow {
    background: rgba(255,255,255,0.2); padding: 2px 7px;
    border-radius: 6px; font-size: 11px; font-weight: 600;
  }
  .pc-trust {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; color: #9CA3AF; font-weight: 500; white-space: nowrap;
  }
  .pc-trust-dot {
    width: 3px; height: 3px; border-radius: 50%;
    background: #D1D5DB; flex-shrink: 0; display: inline-block;
  }

  /* ── Tablet ≤ 960px ── */
  @media (max-width: 960px) {
    .pc-grid { grid-template-columns: 1fr; }
    .pc-vdivider { display: none; }
    .pc-left { padding: 22px 22px 16px; border-bottom: 1px solid #F1F5F9; }
    .pc-right { padding: 18px 22px 22px; }
    .pc-tiers { flex-wrap: wrap; }
    .pc-tier { flex: 1 1 120px; width: auto; }
    .pc-cta-row { flex-wrap: wrap; }
  }

  /* ── Mobile ≤ 560px ── */
  @media (max-width: 560px) {
    .pc-root { padding: 0 16px; margin-top: -28px; }
    .pc-card { border-radius: 18px; }
    .pc-left { padding: 18px 18px 14px; gap: 12px; }
    .pc-icon { width: 44px; height: 44px; border-radius: 12px; }
    .pc-price-main { font-size: 26px; }
    .pc-right { padding: 16px 18px 20px; gap: 14px; }
    .pc-tiers { flex-direction: column; gap: 10px; }
    .pc-tier { width: 100%; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; }
    .pc-tier-price { font-size: 16px; }
    .pc-cta-btn { width: 100%; justify-content: center; }
    .pc-trust { flex-wrap: wrap; }
  }

  /* ── Tiny ≤ 360px ── */
  @media (max-width: 360px) {
    .pc-price-main { font-size: 22px; }
    .pc-left { gap: 10px; }
  }
`}</style>

{/* ── Card ── */}
<div className="pc-root">
  <div className="pc-card">

    {/* Accent bar */}
    <div className="pc-accent-bar" />

    <div className="pc-grid">

      {/* ─── LEFT: Product identity ─── */}
      <div className="pc-left">
        <div className="pc-icon">
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="#0D9B6C" fillOpacity={0.2} />
            <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#0D9B6C" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          </svg>
        </div>

        <div>
          {/* Label + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' as const }}>
            <span className="pc-label">20L Sealed Can</span>
            <span className="pc-badge">BIS Certified</span>
          </div>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '4px 0 6px', flexWrap: 'wrap' as const }}>
            <span className="pc-price-main">₹12</span>
            <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>– ₹15 / can</span>
          </div>

          {/* Savings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span className="pc-save-pill">
              <svg width={11} height={11} viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 1l1.8 4h4.2l-3.4 2.6 1.3 4L8 9.2l-3.9 2.4 1.3-4L2 5h4.2z" fill="#CA8A04" />
              </svg>
              Save 30–40%
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', textDecoration: 'line-through' }}>
              Market ₹18–22
            </span>
          </div>
        </div>
      </div>

      {/* ─── Vertical divider ─── */}
      <div className="pc-vdivider" />

      {/* ─── RIGHT: Tiers + CTA ─── */}
      <div className="pc-right">

        {/* Tier pills */}
        <div className="pc-tiers">
          {(
            [
              { label: 'Pay‑as‑go',    sublabel: 'No commitment', price: '₹10–12', bg: '#F8FAFF', border: '1px solid #DBEAFE',    tc: '#1E3A8A', lc: '#3B82F6', sc: '#93C5FD', best: false },
              { label: 'Subscription', sublabel: 'Most popular',  price: '₹10',    bg: '#F0FDF9', border: '1.5px solid #0D9B6C',  tc: '#065F46', lc: '#0D9B6C', sc: '#6EE7B7', best: true  },
              { label: 'Bulk 50+',     sublabel: 'Best per-unit', price: '₹9–11',  bg: '#FFFBEB', border: '1px solid #FDE68A',    tc: '#78350F', lc: '#D97706', sc: '#FCD34D', best: false },
            ] as const
          ).map((t) => (
            <div
              key={t.label}
              className="pc-tier"
              style={{ background: t.bg, border: t.border }}
            >
              {t.best && <div className="pc-best-pin">Best value</div>}
              <div>
                <div className="pc-tier-label" style={{ color: t.lc }}>{t.label}</div>
                <div className="pc-tier-price" style={{ color: t.tc }}>{t.price}</div>
              </div>
              <div className="pc-tier-sub" style={{ color: t.sc }}>{t.sublabel}</div>
            </div>
          ))}
        </div>

        {/* CTA + trust */}
        <div className="pc-cta-row">
          <button
            type="button"
            onClick={() => router.push('/book?service=water_can')}
            className="pc-cta-btn"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="rgba(255,255,255,0.35)" />
              <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
            </svg>
            Order a Can Now
            <span className="pc-cta-arrow">→</span>
          </button>

          <div className="pc-trust">
            <span>Same-day delivery</span>
            <span className="pc-trust-dot" />
            <span>Free first can</span>
            <span className="pc-trust-dot" />
            <span>Cancel anytime</span>
          </div>
        </div>

      </div>
    </div>

  </div>
</div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ maxWidth:1160,margin:'0 auto',padding:'52px 24px 80px' }}>

          {/* section header + tab toggle */}
          <div style={{ display:'flex',flexWrap:'wrap',gap:16,alignItems:'flex-end',justifyContent:'space-between',marginBottom:28 }}>
            <div>
              <h2 style={{ margin:0,fontSize:'clamp(1.5rem,3.5vw,2.2rem)',fontWeight:900,color:'#111827',letterSpacing:'-0.8px' }}>
                Choose your plan
              </h2>
              <p style={{ margin:'6px 0 0',fontSize:14,color:'#6B7280' }}>Transparent pricing. No lock-in. Cancel anytime.</p>
            </div>

            <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10 }}>
              {/* Individual / Business tab */}
              <div style={{ display:'flex',background:'#F3F4F6',borderRadius:12,padding:4,gap:3 }}>
                {(['individual','business'] as PricingTab[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    style={{ padding:'8px 18px',borderRadius:9,fontWeight:700,fontSize:13,border:'none',cursor:'pointer',background:tab===t?'#fff':'transparent',color:tab===t?'#111827':'#6B7280',boxShadow:tab===t?'0 1px 6px rgba(0,0,0,0.1)':'none',transition:'all 0.2s' }}
                  >
                    {t === 'individual' ? '👤 Individual' : '🏢 Business'}
                  </button>
                ))}
              </div>

              {/* Billing cycle toggle */}
              <div className="billing-toggle" style={{ display:'flex',alignItems:'center',gap:8,background:'#F9FAFB',borderRadius:999,padding:'5px 8px',border:'1.5px solid #E5E7EB' }}>
                <button type="button" onClick={() => setBilling('monthly')} style={{ padding:'5px 14px',borderRadius:999,fontWeight:700,fontSize:12,border:'none',cursor:'pointer',background:billing==='monthly'?'#fff':'transparent',color:billing==='monthly'?'#111827':'#9CA3AF',boxShadow:billing==='monthly'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>Monthly</button>
                <button type="button" onClick={() => setBilling('yearly')} style={{ padding:'5px 14px',borderRadius:999,fontWeight:700,fontSize:12,border:'none',cursor:'pointer',background:billing==='yearly'?'#fff':'transparent',color:billing==='yearly'?'#111827':'#9CA3AF',boxShadow:billing==='yearly'?'0 1px 4px rgba(0,0,0,0.08)':'none',display:'flex',alignItems:'center',gap:5 }}>
                  Yearly <Pill color="green">Save 15%</Pill>
                </button>
              </div>
            </div>
          </div>

          {/* Plan cards */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:22 }}>
            {activePlans.map(plan => (
              <div key={plan.id} className="plan-card">
                <SubCard plan={plan} cycle={billing} onCta={() => handlePlanCta(plan)} />
              </div>
            ))}
          </div>

          {/* Compare table toggle */}
          <div style={{ textAlign:'center',marginTop:28 }}>
            <button
              type="button"
              onClick={() => setShowCompare(v => !v)}
              style={{ background:'none',border:'1.5px solid #E5E7EB',borderRadius:12,padding:'10px 22px',fontSize:13,fontWeight:700,color:'#374151',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7 }}
            >
              {showCompare ? 'Hide' : 'Compare all plans'}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ transform:showCompare?'rotate(180deg)':'none',transition:'transform 0.2s' }}><path d="M2.5 4.5L6.5 8.5L10.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          {showCompare && (
            <div style={{ marginTop:22, animation:'fadeUp 0.3s ease both' }}>
              <CompareTable />
            </div>
          )}

          {/* ── Savings Calculator ── */}
          <div style={{ marginTop:60 }}>
            <div style={{ display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',marginBottom:4 }}>
              <h2 style={{ margin:0,fontSize:'clamp(1.3rem,3vw,2rem)',fontWeight:900,color:'#111827',letterSpacing:'-0.5px' }}>See your savings</h2>
              <Pill color="blue">Interactive</Pill>
            </div>
            <p style={{ margin:'6px 0 0',fontSize:14,color:'#6B7280' }}>Drag the slider to match your usage and see exactly how much you save.</p>
            <div style={{ maxWidth:580 }}>
              <SavingsCalc />
            </div>
          </div>

          {/* ── Other services pricing ── */}
          <div style={{ marginTop:60 }}>
            <h2 style={{ margin:'0 0 6px',fontSize:'clamp(1.3rem,3vw,2rem)',fontWeight:900,color:'#111827',letterSpacing:'-0.5px' }}>Other water services</h2>
            <p style={{ margin:'0 0 22px',fontSize:14,color:'#6B7280' }}>All prices transparent. You see the full breakdown before confirming.</p>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16 }}>
              {[
                { emoji:'🚰',name:'Water Tanker',price:'₹299–₹799',unit:'per tanker',note:'Up to 5000L. Same-day in 8 cities.', tag:'Popular' },
                { emoji:'🔧',name:'Plumber',price:'₹149',unit:'per visit',note:'Starting rate. Pay after service.', tag:'' },
                { emoji:'⛏️',name:'Borewell Service',price:'₹499',unit:'per visit',note:'Drilling & inspection included.', tag:'' },
                { emoji:'⚙️',name:'Motor Repair',price:'₹299',unit:'per visit',note:'All motor types. Warranty on parts.', tag:'' },
                { emoji:'💧',name:'RO Service',price:'₹349',unit:'per visit',note:'Filter change + sanitization.', tag:'New' },
                { emoji:'🪣',name:'Tank Cleaning',price:'₹599',unit:'per tank',note:'Certified hygienic cleaning.', tag:'' },
              ].map(s => (
                <div key={s.name} style={{ background:'#fff',borderRadius:16,border:'1.5px solid #E5E7EB',padding:'18px 20px',display:'flex',flexDirection:'column',gap:10,transition:'all 0.2s',cursor:'pointer' }}
                  onClick={() => router.push(`/book?service=${s.name.toLowerCase().replace(/\s+/g,'_')}`)}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor='#0D9B6C'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 6px 20px rgba(13,155,108,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor='#E5E7EB'; (e.currentTarget as HTMLDivElement).style.boxShadow='none'; }}
                >
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                    <span style={{ fontSize:28 }}>{s.emoji}</span>
                    {s.tag && <Pill color={s.tag === 'New' ? 'blue' : 'green'}>{s.tag}</Pill>}
                  </div>
                  <div>
                    <div style={{ fontWeight:800,fontSize:14,color:'#111827' }}>{s.name}</div>
                    <div style={{ fontSize:11,color:'#6B7280',marginTop:2 }}>{s.note}</div>
                  </div>
                  <div style={{ display:'flex',alignItems:'baseline',gap:4 }}>
                    <span style={{ fontSize:22,fontWeight:900,color:'#0D9B6C',letterSpacing:'-0.5px' }}>{s.price}</span>
                    <span style={{ fontSize:12,color:'#9CA3AF' }}>{s.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── AMC ── */}
          <div style={{ marginTop:52 }}>
            <div style={{ borderRadius:22,background:'linear-gradient(135deg,#0C4A6E,#0369A1 55%,#0284C7)',padding:'40px 36px',position:'relative',overflow:'hidden' }}>
              <div style={{ position:'absolute',inset:0,opacity:0.05,backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)',backgroundSize:'24px 24px',pointerEvents:'none' }} />
              <div style={{ position:'absolute',top:-80,right:-80,width:300,height:300,borderRadius:'50%',background:'#38BDF8',opacity:0.1,pointerEvents:'none' }} />
              <div style={{ position:'relative',zIndex:1,display:'flex',flexWrap:'wrap',gap:24,alignItems:'center',justifyContent:'space-between' }}>
                <div>
                  <Pill color="blue">Annual Maintenance Contract</Pill>
                  <h2 style={{ margin:'12px 0 6px',fontSize:'clamp(1.3rem,3.5vw,1.8rem)',fontWeight:900,color:'#fff',letterSpacing:'-0.5px' }}>
                    Need worry-free water all year?
                  </h2>
                  <p style={{ margin:0,color:'rgba(255,255,255,0.65)',fontSize:14,lineHeight:1.6,maxWidth:440 }}>
                    <strong style={{ color:'#7DD3FC' }}>₹4,999/year</strong> — includes 6 service visits, priority booking, free filter change, and free annual water quality test.
                  </p>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginTop:14 }}>
                    {['6 service visits','Free RO filter change','Priority slots','Water quality test'].map(t => (
                      <div key={t} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.09)',borderRadius:999,padding:'5px 12px',border:'1px solid rgba(255,255,255,0.12)' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span style={{ fontSize:12,color:'rgba(255,255,255,0.8)',fontWeight:600 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => router.push('/contact')}
                  style={{ background:'#fff',color:'#0C4A6E',fontWeight:800,fontSize:14,padding:'14px 28px',borderRadius:14,border:'none',cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:8 }}>
                  Get AMC
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#0C4A6E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Trust strip ── */}
          <div style={{ marginTop:44,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14 }}>
            {[
              { icon:'🔒',title:'No hidden charges',sub:'Full breakdown shown at checkout.' },
              { icon:'↩️',title:'Free cancellation',sub:'Up to 2 hours before delivery.' },
              { icon:'📋',title:'GST invoices',sub:'Available on Pro & Business plans.' },
              { icon:'💬',title:'WhatsApp support',sub:'Get answers in under 10 minutes.' },
            ].map(t => (
              <div key={t.title} style={{ background:'#fff',borderRadius:14,border:'1.5px solid #F3F4F6',padding:'16px 18px',display:'flex',gap:12,alignItems:'flex-start' }}>
                <span style={{ fontSize:20,flexShrink:0 }}>{t.icon}</span>
                <div>
                  <div style={{ fontWeight:700,fontSize:13,color:'#111827' }}>{t.title}</div>
                  <div style={{ fontSize:12,color:'#6B7280',marginTop:2,lineHeight:1.45 }}>{t.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── FAQ ── */}
          <div style={{ marginTop:64 }}>
            <div style={{ maxWidth:700 }}>
              <h2 style={{ margin:'0 0 6px',fontSize:'clamp(1.3rem,3vw,2rem)',fontWeight:900,color:'#111827',letterSpacing:'-0.5px' }}>
                Frequently asked questions
              </h2>
              <p style={{ margin:'0 0 24px',fontSize:14,color:'#6B7280' }}>Everything you need to know about pricing and delivery.</p>
              <FaqAccordion faq={faq} />
            </div>
          </div>

          {/* ── Bottom CTA ── */}
          <div style={{ marginTop:64,borderRadius:22,background:'linear-gradient(135deg,#022C22,#065F46 60%,#0D9B6C)',padding:'48px 40px',position:'relative',overflow:'hidden',textAlign:'center' }}>
            <div style={{ position:'absolute',inset:0,opacity:0.05,backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)',backgroundSize:'24px 24px',pointerEvents:'none' }} />
            <div style={{ position:'relative',zIndex:1 }}>
              <div style={{ fontSize:'clamp(1.5rem,4vw,2.5rem)',fontWeight:900,color:'#fff',letterSpacing:'-0.8px',fontFamily:'Syne,sans-serif' }}>
                Still deciding?
              </div>
              <p style={{ color:'rgba(255,255,255,0.6)',fontSize:15,marginTop:10,marginBottom:28,maxWidth:400,margin:'10px auto 28px' }}>
                Order a single can at ₹10 today — no signup required. Upgrade to a subscription when you're ready.
              </p>
              <div style={{ display:'flex',flexWrap:'wrap',gap:12,justifyContent:'center' }}>
                <button type="button" onClick={() => router.push('/book?service=water_can')}
                  style={{ background:'#fff',color:'#065F46',fontWeight:800,fontSize:15,padding:'14px 28px',borderRadius:14,border:'none',cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}>
                  Order a Can — ₹10–12
                </button>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer"
                  style={{ background:'rgba(255,255,255,0.12)',color:'#fff',fontWeight:700,fontSize:15,padding:'14px 28px',borderRadius:14,border:'1px solid rgba(255,255,255,0.2)',cursor:'pointer',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:8 }}>
                  <IconWA /> Chat with us
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}









































// 'use client';

// import React, { useMemo, useState } from 'react';
// import { useRouter } from 'next/navigation';

// type PricingTab = 'individual' | 'business';

// type FaqItem = { q: string; a: string };

// const WHATSAPP = 'https://wa.me/919889305803';

// export default function PricingPage() {
//   const router = useRouter();
//   const [tab, setTab] = useState<PricingTab>('individual');
//   const [openFaq, setOpenFaq] = useState<number | null>(0);

//   const faq: FaqItem[] = useMemo(
//     () => [
//       {
//         q: 'Is delivery free?',
//         a: 'Platform fee ₹29 applies. No other charges.',
//       },
//       {
//         q: 'Can I cancel a booking?',
//         a: 'Yes, free cancellation is available up to 2 hours before the scheduled slot.',
//       },
//       {
//         q: 'What payment methods are accepted?',
//         a: 'Cash, UPI, and online options (online enabled where available).',
//       },
//       {
//         q: 'How are prices calculated?',
//         a: 'Base price + platform fee + GST (shown upfront in the booking review).',
//       },
//       {
//         q: 'Do you offer GST invoices?',
//         a: 'Yes, GST invoices are available for business accounts.',
//       },
//       {
//         q: 'What is same-day service availability?',
//         a: 'Same-day service is available in 8 cities before 4PM.',
//       },
//     ],
//     []
//   );

//   const businessTable = useMemo(
//     () => [
//       { service: 'Water Tanker', p1: '₹299', p2: '₹279', p3: '₹249' },
//       { service: 'Plumbing', p1: '₹149', p2: '₹129', p3: 'Custom' },
//     ],
//     []
//   );

//   const WhatsAppIcon = (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path
//         d="M20 11.5C20 15.64 16.42 19 12.2 19C10.7 19 9.3 18.61 8.1 17.9L4 19L5.1 15.2C4.45 14 4.1 12.7 4.1 11.5C4.1 7.36 7.68 4 11.9 4C16.12 4 20 7.36 20 11.5Z"
//         stroke="currentColor"
//         strokeWidth="1.7"
//         strokeLinejoin="round"
//       />
//       <path
//         d="M9.2 9.4C9.4 9.1 9.7 9 10 9C10.3 9 10.6 9.1 10.7 9.4L11.3 10.7C11.4 10.9 11.4 11.1 11.3 11.3L11 11.7C10.9 11.8 10.9 12 11 12.2C11.3 12.8 11.8 13.4 12.4 13.7C12.6 13.8 12.8 13.8 12.9 13.7L13.3 13.4C13.5 13.3 13.7 13.3 13.9 13.4L15.2 14C15.5 14.1 15.6 14.4 15.6 14.7C15.6 15 15.5 15.3 15.3 15.5C15 15.7 14.7 15.9 14.4 16C14 16.1 13.6 16.1 13.2 16C10.8 15.2 9 13.4 8.2 11C8.1 10.6 8.1 10.2 8.2 9.8C8.3 9.5 8.5 9.2 9.2 9.4Z"
//         fill="currentColor"
//         opacity="0.95"
//       />
//     </svg>
//   );

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
//         <div className="max-w-3xl">
//           <h1 className="text-[clamp(1.75rem,5vw,3.5rem)] font-extrabold text-[#0F1C18]">
//             Simple, Transparent Pricing
//           </h1>
//           <p className="text-base sm:text-lg text-slate-600 mt-3">No hidden charges. No surprises.</p>
//         </div>

//         <div className="mt-8 flex flex-wrap gap-2">
//           <button
//             type="button"
//             onClick={() => setTab('individual')}
//             className={[
//               'px-4 py-2 rounded-full border text-sm font-extrabold transition-all duration-150',
//               tab === 'individual'
//                 ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]'
//                 : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
//             ].join(' ')}
//           >
//             Individual
//           </button>
//           <button
//             type="button"
//             onClick={() => setTab('business')}
//             className={[
//               'px-4 py-2 rounded-full border text-sm font-extrabold transition-all duration-150',
//               tab === 'business'
//                 ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]'
//                 : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
//             ].join(' ')}
//           >
//             Business/Bulk
//           </button>
//         </div>

//         {tab === 'individual' ? (
//           <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
//             {/* Water Delivery */}
//             <article className="relative rounded-3xl bg-[#0F172A] border border-[#0D9B6C]/40 p-7 shadow-card overflow-hidden">
//               <div className="absolute -top-3 left-6">
//                 <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#0D9B6C] text-white text-xs font-extrabold shadow-sm">
//                   Most Popular
//                 </span>
//               </div>
//               <div className="flex items-start justify-between gap-4">
//                 <div>
//                   <div className="text-2xl">💧</div>
//                   <h2 className="mt-1 font-extrabold text-white text-lg">Water Delivery</h2>
//                 </div>
//                 <div className="text-right">
//                   <div className="text-3xl font-extrabold text-[#38BDF8]">₹299</div>
//                   <div className="text-sm font-semibold text-white/70">/ delivery</div>
//                 </div>
//               </div>

//               <ul className="mt-5 space-y-2 text-sm text-white/85">
//                 <li>✅ Up to 3000L tanker</li>
//                 <li>✅ Price: ₹299–₹799 (size-based)</li>
//                 <li>✅ Platform fee: ₹29/order</li>
//                 <li>✅ Delivery: same-day available</li>
//                 <li>✅ Unlimited orders per month</li>
//                 <li>✅ Cash / UPI on delivery</li>
//                 <li>✅ Order via app or WhatsApp</li>
//               </ul>

//               <button
//                 type="button"
//                 onClick={() => router.push('/book?service=water_tanker')}
//                 className="mt-7 w-full rounded-2xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all duration-150"
//               >
//                 Order Now
//               </button>
//             </article>

//             {/* Plumber Booking */}
//             <article className="rounded-3xl bg-[#0F172A] border border-slate-800 p-7 shadow-card overflow-hidden">
//               <div className="flex items-start justify-between gap-4">
//                 <div>
//                   <div className="text-2xl">🔧</div>
//                   <h2 className="mt-1 font-extrabold text-white text-lg">Plumber Booking</h2>
//                 </div>
//                 <div className="text-right">
//                   <div className="text-3xl font-extrabold text-[#0D9B6C]">₹149</div>
//                   <div className="text-sm font-semibold text-white/70">/ visit</div>
//                 </div>
//               </div>

//               <ul className="mt-5 space-y-2 text-sm text-white/85">
//                 <li>✅ Starting at ₹149/hr</li>
//                 <li>✅ 6 service categories</li>
//                 <li>✅ Verified & rated plumbers</li>
//                 <li>✅ Emergency 2-hr response</li>
//                 <li>✅ Before/after job photos</li>
//                 <li>✅ Pay after service</li>
//               </ul>

//               <button
//                 type="button"
//                 onClick={() => router.push('/book?service=plumbing')}
//                 className="mt-7 w-full rounded-2xl border-2 border-[#0D9B6C] text-[#E8F8F2] font-extrabold py-3 hover:bg-[#E8F8F2]/10 active:scale-95 transition-all duration-150"
//               >
//                 Book Plumber
//               </button>
//             </article>

//             {/* Bulk / Business */}
//             <article className="rounded-3xl bg-[#0F172A] border border-slate-800 p-7 shadow-card overflow-hidden">
//               <div className="flex items-start justify-between gap-4">
//                 <div>
//                   <div className="text-2xl">🚛</div>
//                   <h2 className="mt-1 font-extrabold text-white text-lg">Bulk / Business</h2>
//                 </div>
//                 <div className="text-right">
//                   <div className="text-3xl font-extrabold text-[#38BDF8]">Custom</div>
//                   <div className="text-sm font-semibold text-white/70">pricing</div>
//                 </div>
//               </div>

//               <ul className="mt-5 space-y-2 text-sm text-white/85">
//                 <li>✅ Offices, apartments, restaurants</li>
//                 <li>✅ ₹250–₹700/delivery bulk rate</li>
//                 <li>✅ Tanker supply available</li>
//                 <li>✅ Multiple delivery addresses</li>
//                 <li>✅ GST invoice monthly</li>
//                 <li>✅ Dedicated account manager</li>
//               </ul>

//               <a
//                 href={WHATSAPP}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#0D9B6C] text-[#E8F8F2] font-extrabold py-3 hover:bg-[#E8F8F2]/10 active:scale-95 transition-all duration-150"
//               >
//                 <span className="text-[#0D9B6C]">{WhatsAppIcon}</span>
//                 Get Quote on WhatsApp
//               </a>
//             </article>
//           </div>
//         ) : (
//           <div className="mt-8 rounded-3xl bg-[#0F172A] border border-slate-800 shadow-card overflow-hidden">
//             <div className="p-7">
//               <div className="flex items-start justify-between gap-4">
//                 <div>
//                   <h2 className="text-white font-extrabold text-xl">Bulk pricing table</h2>
//                   <p className="text-white/70 mt-2 text-sm">
//                     Discounts based on monthly order volume. Exact quotes confirmed via WhatsApp.
//                   </p>
//                 </div>
//               </div>

//               <div className="mt-6 overflow-x-auto">
//                 <table className="w-full text-left text-sm" aria-label="Bulk pricing table">
//                   <thead>
//                     <tr className="text-white/70">
//                       <th className="py-3 pr-4">Service</th>
//                       <th className="py-3 pr-4">1-10 orders</th>
//                       <th className="py-3 pr-4">11-50</th>
//                       <th className="py-3">50+</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {businessTable.map((row) => (
//                       <tr key={row.service} className="border-t border-white/10">
//                         <td className="py-4 pr-4 text-white font-extrabold">{row.service}</td>
//                         <td className="py-4 pr-4 text-white/90">{row.p1}</td>
//                         <td className="py-4 pr-4 text-white/90">{row.p2}</td>
//                         <td className="py-4 text-white/90">{row.p3}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>

//               <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
//                 <div className="text-white font-extrabold">Need a custom quote?</div>
//                 <a
//                   href={WHATSAPP}
//                   target="_blank"
//                   rel="noopener noreferrer"
//                   className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] transition-all duration-150"
//                 >
//                   {WhatsAppIcon} Get Quote on WhatsApp
//                 </a>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* AMC */}
//         <div className="mt-8 rounded-3xl bg-[#0F172A] border border-[#0D9B6C]/30 shadow-card overflow-hidden">
//           <div className="p-7 md:p-9 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
//             <div>
//               <div className="text-[#0D9B6C] font-extrabold text-sm tracking-wide uppercase">Annual Maintenance Contract</div>
//               <div className="text-white font-extrabold text-2xl mt-2">
//                 Need Annual Maintenance Contract (AMC)?
//               </div>
//               <div className="text-white/80 mt-2 text-sm">
//                 ₹4,999/year | Includes: 6 service visits, priority booking, free filter change
//               </div>
//             </div>
//             <button
//               type="button"
//               onClick={() => router.push('/contact')}
//               className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-7 py-3 hover:bg-[#086D4C] active:scale-95 transition-all duration-150"
//             >
//               Contact for AMC
//             </button>
//           </div>
//         </div>

//         {/* FAQ */}
//         <div className="mt-12 max-w-3xl">
//           <h2 className="text-2xl font-extrabold text-[#0F1C18]">FAQ</h2>
//           <p className="text-slate-600 mt-2">Answers to common questions about transparent pricing.</p>
//           <div className="mt-6 space-y-3">
//             {faq.map((item, idx) => {
//               const open = openFaq === idx;
//               return (
//                 <div key={item.q} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
//                   <button
//                     type="button"
//                     onClick={() => setOpenFaq((cur) => (cur === idx ? null : idx))}
//                     className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left"
//                   >
//                     <div className="font-extrabold text-slate-900">{item.q}</div>
//                     <div className="text-[#0D9B6C] font-extrabold">{open ? '−' : '+'}</div>
//                   </button>
//                   {open && <div className="px-5 pb-5 text-slate-600 text-sm">{item.a}</div>}
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }
