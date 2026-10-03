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
