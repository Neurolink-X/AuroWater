// 'use client';

// import Link from 'next/link';
// import React, { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';
// import { TRUST_REVIEWS } from '@/lib/trust-reviews';

// interface FoundingStats {
//   count: number;
// }

// export default function HomePage() {
//   const [founding, setFounding] = useState<FoundingStats | null>(null);
//   const [name, setName] = useState('');
//   const [phone, setPhone] = useState('');
//   const [foundingMsg, setFoundingMsg] = useState<string | null>(null);
//   const [submitting, setSubmitting] = useState(false);

//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch('/api/founding-members', { cache: 'no-store' });
//         const json = await res.json();
//         if (json?.success) {
//           setFounding(json.data);
//         }
//       } catch {
//         // Best-effort; landing page should still work.
//       }
//     })();
//   }, []);

//   const claimed = Math.min(founding?.count ?? 73, 100);
//   const total = 100;
//   const progress = (claimed / total) * 100;

//   const handleFoundingSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setFoundingMsg(null);
//     if (!name.trim() || !phone.trim()) {
//       setFoundingMsg('Please enter your name and phone.');
//       return;
//     }
//     setSubmitting(true);
//     try {
//       const res = await fetch('/api/founding-members', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
//       });
//       const json = await res.json();
//       if (!res.ok || !json?.success) {
//         setFoundingMsg(json?.error || 'Could not save your details. Please try again.');
//       } else {
//         setFoundingMsg(json?.message || 'Welcome to the founding members!');
//         setName('');
//         setPhone('');
//         // optimistic bump
//         setFounding((prev) => ({ count: (prev?.count ?? 0) + 1 }));
//       }
//     } catch {
//       setFoundingMsg('Network error. Please try again.');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-950 text-slate-50">
//       {/* HERO */}
//       <section className="relative overflow-hidden bg-[#0A2342] text-white">
//         <div className="hero-water-bg" />
//         <svg
//           className="animate-float absolute right-0 top-0 opacity-20 pointer-events-none"
//           width="240"
//           height="180"
//           viewBox="0 0 240 180"
//           aria-hidden="true"
//         >
//           <circle
//             cx="210"
//             cy="50"
//             r="40"
//             fill="none"
//             stroke="white"
//             strokeWidth="3"
//             className="animate-float"
//             style={{ animationDelay: '0s' }}
//           />
//           <circle
//             cx="210"
//             cy="50"
//             r="25"
//             fill="none"
//             stroke="white"
//             strokeWidth="3"
//             className="animate-float"
//             style={{ animationDelay: '0.5s' }}
//           />
//           <circle
//             cx="210"
//             cy="50"
//             r="15"
//             fill="none"
//             stroke="white"
//             strokeWidth="3"
//             className="animate-float"
//             style={{ animationDelay: '1s' }}
//           />
//         </svg>
//         <div className="hero-ripple -right-40 -top-32 hidden sm:block" />
//         <div className="hero-ripple -left-40 -bottom-40 opacity-60" />

//         <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
//             <motion.div
//               initial={{ opacity: 0, y: 24 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.6, ease: 'easeOut' }}
//             >
//               <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-cyan-300 mb-4">
//                 AuroWater · ऑन-डिमांड पानी + प्लम्बर
//               </p>
//               <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
//                 <span className="block text-cyan-300">
//                   शुद्ध पानी। सीधे आपके दरवाज़े तक।
//                 </span>
//                 <span className="mt-2 block text-white">
//                   Pure Water. Delivered to Your Door.
//                 </span>
//               </h1>
//               <p className="mt-5 text-base sm:text-lg text-cyan-50/80 max-w-xl">
//                 Water delivery + plumber service for everyone. Students, families, offices,
//                 and events — all managed in one simple app experience.
//               </p>

//               <div className="mt-8 flex flex-wrap gap-4">
//                 <Link
//                   href="/book?service=water_tanker"
//                   className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00BCD4] to-cyan-500 px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-slate-950 shadow-card hover:opacity-95 transition"
//                 >
//                   <span>💧 Order Water Now</span>
//                 </Link>
//                 <Link
//                   href="/book?service=plumbing"
//                   className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/60 bg-white/5 px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-cyan-100 hover:bg-white/10 transition"
//                 >
//                   <span>🔧 Book a Plumber</span>
//                 </Link>
//               </div>

//               <motion.div
//                 className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm"
//                 initial={{ opacity: 0, y: 16 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ delay: 0.2, duration: 0.5 }}
//               >
//                 {[
//                   { label: 'Daily Deliveries', value: '500+' },
//                   { label: 'Plumbers', value: '50+' },
//                   { label: 'Suppliers', value: '20+' },
//                   { label: 'Rating', value: '⭐ 4.8' },
//                 ].map((item) => (
//                   <div
//                     key={item.label}
//                     className="rounded-2xl border border-cyan-300/25 bg-white/5 px-3 py-3 backdrop-blur-md"
//                   >
//                     <p className="text-xs text-cyan-100/70">{item.label}</p>
//                     <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
//                   </div>
//                 ))}
//               </motion.div>
//             </motion.div>

//             <motion.div
//               className="space-y-4 lg:space-y-6"
//               initial={{ opacity: 0, y: 32 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: 0.15, duration: 0.6 }}
//             >
//               <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 backdrop-blur-xl shadow-card">
//                 <h2 className="text-sm font-semibold text-cyan-200 uppercase tracking-wide">
//                   Why AuroWater
//                 </h2>
//                 <ul className="mt-4 space-y-3 text-sm text-cyan-50/90">
//                   <li>• Water cans at ₹10–15 with real-time availability.</li>
//                   <li>• Verified suppliers & plumbers from your local area.</li>
//                   <li>• Cash + UPI · Hindi + English support.</li>
//                   <li>• Emergency delivery in under 2 hours (select areas).</li>
//                 </ul>
//               </div>

//               <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                   <p className="text-cyan-200 font-semibold mb-1">Students & PG</p>
//                   <p className="text-cyan-50/80">Daily cans, no landlord drama.</p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                   <p className="text-cyan-200 font-semibold mb-1">Families & Flats</p>
//                   <p className="text-cyan-50/80">Regular supply + trusted plumbers.</p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                   <p className="text-cyan-200 font-semibold mb-1">Offices & Cafes</p>
//                   <p className="text-cyan-50/80">Subscriptions with priority support.</p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                   <p className="text-cyan-200 font-semibold mb-1">Events & Weddings</p>
//                   <p className="text-cyan-50/80">Bulk bookings with on-site support.</p>
//                 </div>
//               </div>
//             </motion.div>
//           </div>

//           <div className="scroll-indicator absolute left-1/2 -translate-x-1/2 bottom-8 flex flex-col items-center gap-2 pointer-events-none">
//             <span className="text-xs sm:text-sm text-cyan-50/85 font-semibold">Scroll to explore</span>
//             <div className="bounce-arrow text-white text-lg leading-none">↓</div>
//           </div>
//         </div>
//       </section>

//       {/* THREE PATHS */}
//       <section className="bg-slate-50 py-14 sm:py-18 lg:py-20">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-10">
//             Three paths — pick the one that fits you
//           </h2>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">
//             <div className="glass-card p-6 sm:p-7 rounded-2xl border border-slate-100 hover-lift transition-all">
//               <div className="text-3xl mb-3">💧</div>
//               <div className="font-bold text-slate-900 text-lg sm:text-xl">I Need Water & Plumber</div>
//               <p className="text-sm sm:text-base text-slate-600 mt-2">
//                 Order water, book plumbers, track deliveries. Sign up in 30 seconds.
//               </p>
//               <ul className="mt-4 space-y-2 text-sm text-slate-700">
//                 <li>✅ Instant signup</li>
//                 <li>✅ No documents needed</li>
//                 <li>✅ Start ordering immediately</li>
//               </ul>
//               <Link
//                 href="/auth/register"
//                 className="mt-6 inline-flex items-center justify-center w-full rounded-full bg-gradient-to-r from-[#0D9B6C] to-[#38BDF8] text-white px-6 py-3 text-sm sm:text-base font-semibold hover:opacity-95 transition"
//               >
//                 Sign Up Free →
//               </Link>
//             </div>

//             <div className="glass-card p-6 sm:p-7 rounded-2xl border border-slate-100 hover-lift transition-all">
//               <div className="text-3xl mb-3">🚛</div>
//               <div className="font-bold text-slate-900 text-lg sm:text-xl">I Supply Water</div>
//               <p className="text-sm sm:text-base text-slate-600 mt-2">
//                 Partner with us to deliver water. Get verified and receive orders.
//               </p>
//               <ul className="mt-4 space-y-2 text-sm text-slate-700">
//                 <li>✅ KYC verification required</li>
//                 <li>✅ Admin approval process</li>
//                 <li>✅ Start earning once approved</li>
//               </ul>
//               <Link
//                 href="/auth/register?role=supplier"
//                 className="mt-6 inline-flex items-center justify-center w-full rounded-full border-2 border-[#0D9B6C] text-[#0D9B6C] px-6 py-3 text-sm sm:text-base font-semibold hover:bg-[#E8F8F2] transition"
//               >
//                 Apply as Supplier →
//               </Link>
//             </div>

//             <div className="glass-card p-6 sm:p-7 rounded-2xl border border-slate-100 hover-lift transition-all">
//               <div className="text-3xl mb-3">🔧</div>
//               <div className="font-bold text-slate-900 text-lg sm:text-xl">I&apos;m a Plumber / Technician</div>
//               <p className="text-sm sm:text-base text-slate-600 mt-2">
//                 Get verified, showcase your skills, and receive job requests from customers.
//               </p>
//               <ul className="mt-4 space-y-2 text-sm text-slate-700">
//                 <li>✅ Skill verification</li>
//                 <li>✅ Background check</li>
//                 <li>✅ Earn on your schedule</li>
//               </ul>
//               <Link
//                 href="/auth/register?role=technician"
//                 className="mt-6 inline-flex items-center justify-center w-full rounded-full border-2 border-[#0D9B6C] text-[#0D9B6C] px-6 py-3 text-sm sm:text-base font-semibold hover:bg-[#E8F8F2] transition"
//               >
//                 Apply as Plumber →
//               </Link>
//             </div>
//           </div>

//           <div className="mt-6 text-center text-sm text-slate-700">
//             🛡️ All accounts are phone-verified. Suppliers &amp; plumbers undergo KYC verification before activation.
//           </div>
//         </div>
//       </section>

//       {/* WHY AUROWATER */}
//       <section className="bg-white py-14 sm:py-18 lg:py-20">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-10">
//             Why AuroWater
//           </h2>

//           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
//             {[
//               { icon: '⚡', title: 'Same-day Service', desc: 'Book by 2PM, get service today in most cities.' },
//               { icon: '💰', title: 'No Hidden Charges', desc: 'Price shown = Price paid. Always.' },
//               { icon: '✅', title: 'Verified Professionals', desc: 'Every technician background-checked and ID-verified.' },
//               { icon: '📱', title: 'Easy Tracking', desc: 'Real-time updates from booking to completion.' },
//             ].map((f) => (
//               <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card hover-lift transition-all">
//                 <div className="w-12 h-12 rounded-2xl bg-[#0D9B6C]/10 flex items-center justify-center text-[#0D9B6C] text-xl">
//                   {f.icon}
//                 </div>
//                 <div className="font-bold text-slate-900 mt-4">{f.title}</div>
//                 <div className="text-sm text-slate-600 mt-2">{f.desc}</div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* SERVICES STRIP */}
//       <section className="border-b border-slate-800 bg-slate-950/95">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//           <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-xs sm:text-sm text-slate-200">
//             <span>✅ Verified Suppliers</span>
//             <span>✅ Always Free Delivery</span>
//             <span>✅ Cash + UPI</span>
//             <span>✅ Hindi + English Support</span>
//             <span>✅ 2hr Emergency Response</span>
//           </div>
//         </div>
//       </section>

//       {/* TRUST REVIEWS MARQUEE */}
//       <section className="bg-white py-12 sm:py-16">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">Trusted by customers</h2>
//           <p className="text-center text-slate-600 mt-2 text-sm sm:text-base">
//             Real experiences from people across UP.
//           </p>

//           <div className="mt-8 space-y-6">
//             {[
//               { dir: 'left', style: { animationDirection: 'normal' as const } },
//               { dir: 'right', style: { animationDirection: 'reverse' as const } },
//             ].map((row) => (
//               <div key={row.dir} className="overflow-hidden">
//                 <div className="marquee-track flex gap-6" style={row.style}>
//                   {[...TRUST_REVIEWS, ...TRUST_REVIEWS].map((r, idx) => (
//                     <div
//                       key={`${r.name}-${idx}`}
//                       className="min-w-[300px] max-w-[360px] rounded-2xl border border-slate-100 bg-white/70 backdrop-blur-md px-6 py-5"
//                     >
//                       <div className="flex items-start justify-between gap-4">
//                         <div className="flex items-center gap-3">
//                           <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${r.color} text-white flex items-center justify-center font-extrabold`}>
//                             {r.initials}
//                           </div>
//                           <div>
//                             <div className="font-extrabold text-slate-900 leading-tight">{r.name}</div>
//                             <div className="mt-1 flex items-center gap-2">
//                               <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#E8F8F2] text-[#0D9B6C] border border-[#0D9B6C]/20">
//                                 {r.city}
//                               </span>
//                             </div>
//                           </div>
//                         </div>
//                         <div className="text-right">
//                           <div className="flex justify-end gap-0.5">
//                             {Array.from({ length: 5 }).map((_, i) => {
//                               const filled = i < r.rating;
//                               return (
//                                 <span
//                                   key={i}
//                                   className={filled ? 'text-[#0D9B6C]' : 'text-slate-300'}
//                                   aria-hidden="true"
//                                 >
//                                   ★
//                                 </span>
//                               );
//                             })}
//                           </div>
//                           <div className="text-[10px] sm:text-xs text-slate-500 mt-1 font-semibold">{r.date}</div>
//                         </div>
//                       </div>

//                       <div className="mt-4 flex flex-wrap gap-2 items-center">
//                         <span className="text-xs font-extrabold px-3 py-1 rounded-full border border-slate-200 text-slate-700 bg-white/70">
//                           {r.service}
//                         </span>
//                       </div>

//                       <p className="mt-3 italic text-sm text-gray-600 leading-relaxed">
//                         “{r.text}”
//                       </p>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* 3 PRIMARY SERVICES */}
//       <section className="bg-slate-50 py-14 sm:py-18 lg:py-20">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <motion.h2
//             className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-10 sm:mb-12"
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.4 }}
//             transition={{ duration: 0.5 }}
//           >
//             Services for every water need
//           </motion.h2>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
//             {[
//               {
//               icon: '💧',
//               title: 'Water Delivery',
//               body: 'Daily cans ₹10–15 · Always free doorstep delivery · Perfect for hostels, families, and offices.',
//               cta: 'Order Now',
//               href: '/book?service=water_tanker',
//               },
//               {
//               icon: '🔧',
//               title: 'Plumber Service',
//               body: 'Fitting, boring, repair, and pump installation by verified local plumbers.',
//               cta: 'Book Now',
//               href: '/book?service=plumbing',
//               },
//               {
//                 icon: '🚚',
//                 title: 'Bulk & Events',
//                 body: 'Weddings, offices, construction, schools — cans, tankers, and plumber teams on demand.',
//                 cta: 'Get Quote',
//                 href: '/contact',
//               },
//             ].map((card) => (
//               <motion.div
//                 key={card.title}
//                 className="glass-card p-6 sm:p-7 rounded-2xl hover-lift"
//                 initial={{ opacity: 0, y: 24 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true, amount: 0.3 }}
//                 transition={{ duration: 0.5 }}
//               >
//                 <div className="text-3xl mb-4">{card.icon}</div>
//                 <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">
//                   {card.title}
//                 </h3>
//                 <p className="text-sm sm:text-base text-slate-600 mb-4">
//                   {card.body}
//                 </p>
//                 <Link
//                   href={card.href}
//                   className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-slate-800 transition"
//                 >
//                   {card.cta} →
//                 </Link>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* WHO WE SERVE */}
//       <section className="bg-white py-14 sm:py-18 lg:py-20">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <motion.h2
//             className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-8 sm:mb-10"
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.4 }}
//           >
//             Who we serve
//           </motion.h2>
//           <motion.div
//             className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-xs sm:text-sm"
//             initial={{ opacity: 0, y: 24 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.2 }}
//           >
//             {[
//               '👨‍🎓 Students',
//               '👨‍💼 Professionals',
//               '🏠 Homeowners',
//               '🏢 Offices',
//               '🎪 Weddings',
//               '🍽️ Restaurants',
//               '🏗️ Construction',
//               '🏫 Schools',
//             ].map((item) => (
//               <div
//                 key={item}
//                 className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-slate-700"
//               >
//                 {item}
//               </div>
//             ))}
//           </motion.div>
//         </div>
//       </section>

//       {/* HOW IT WORKS */}
//       <section className="bg-slate-900 py-14 sm:py-18 lg:py-20">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <motion.h2
//             className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 sm:mb-10"
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.4 }}
//           >
//             How it works
//           </motion.h2>
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
//             {[
//               {
//                 step: '1',
//                 title: '📱 Order in 30 seconds',
//                 body: 'Pick water or plumber, add your address, and select a time slot.',
//               },
//               {
//                 step: '2',
//                 title: '🚚 Supplier accepts & delivers',
//                 body: 'Nearest verified supplier or plumber is assigned automatically.',
//               },
//               {
//                 step: '3',
//                 title: '✅ Done — pay cash or UPI',
//                 body: 'Track status live, pay on completion, and rate your experience.',
//               },
//             ].map((item, idx) => (
//               <motion.div
//                 key={item.step}
//                 className="rounded-2xl border border-cyan-500/30 bg-slate-950/60 p-6 sm:p-7 backdrop-blur-xl"
//                 initial={{ opacity: 0, y: 30 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true, amount: 0.3 }}
//                 transition={{ delay: idx * 0.08, duration: 0.5 }}
//               >
//                 <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-sm font-semibold">
//                   {item.step}
//                 </div>
//                 <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
//                   {item.title}
//                 </h3>
//                 <p className="text-xs sm:text-sm text-slate-200/80">
//                   {item.body}
//                 </p>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* FOUNDING MEMBERS */}
//       <section className="bg-slate-50 py-14 sm:py-18 lg:py-20">
//         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[1.2fr,1fr] items-center">
//           <motion.div
//             initial={{ opacity: 0, y: 24 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//           >
//             <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
//               Join Our First 100 Founding Members
//             </h2>
//             <p className="text-base text-slate-600 mb-4">
//               पहले 100 customers में शामिल हों और हमेशा के लिए बेहतर पानी और प्रायोरिटी
//               सर्विस पाएं।
//             </p>
//             <ul className="text-sm text-slate-700 space-y-1 mb-6">
//               <li>🔒 Lifetime 10% discount on water and services</li>
//               <li>⚡ Always priority delivery window</li>
//               <li>🎁 First order free (up to ₹200)</li>
//               <li>📞 Direct WhatsApp support with the core team</li>
//             </ul>

//             <div className="mb-3 flex items-center justify-between text-xs sm:text-sm">
//               <span className="font-medium text-slate-800">
//                 {claimed} of 100 spots claimed
//               </span>
//             </div>
//             <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-4">
//               <div
//                 className="h-full rounded-full bg-gradient-to-r from-[#00BCD4] to-emerald-500 transition-[width] duration-700"
//                 style={{ width: `${progress}%` }}
//               />
//             </div>
//             <p className="text-xs text-slate-500">
//               Limited founding cohort. We&apos;ll confirm your spot by SMS/WhatsApp.
//             </p>
//           </motion.div>

//           <motion.form
//             onSubmit={handleFoundingSubmit}
//             className="glass-card rounded-2xl p-6 sm:p-7 shadow-card"
//             initial={{ opacity: 0, y: 24 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.2 }}
//           >
//             <h3 className="text-lg font-semibold text-slate-900 mb-4">
//               Reserve your spot
//             </h3>
//             <div className="space-y-3">
//               <div>
//                 <label className="block text-xs font-medium text-slate-600 mb-1">
//                   Full Name
//                 </label>
//                 <input
//                   type="text"
//                   value={name}
//                   onChange={(e) => setName(e.target.value)}
//                   className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
//                   placeholder="e.g. Arjun Singh"
//                   required
//                 />
//               </div>
//               <div>
//                 <label className="block text-xs font-medium text-slate-600 mb-1">
//                   Phone (WhatsApp)
//                 </label>
//                 <input
//                   type="tel"
//                   value={phone}
//                   onChange={(e) => setPhone(e.target.value)}
//                   className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
//                   placeholder="10-digit Indian mobile"
//                   required
//                 />
//               </div>
//               <button
//                 type="submit"
//                 disabled={submitting}
//                 className="mt-2 w-full rounded-full bg-slate-900 text-white text-sm font-semibold py-2.5 hover:bg-slate-800 transition disabled:opacity-60"
//               >
//                 {submitting ? 'Saving…' : 'Join the first 100 →'}
//               </button>
//               {foundingMsg && (
//                 <p className="text-xs text-slate-600 mt-2">{foundingMsg}</p>
//               )}
//             </div>
//           </motion.form>
//         </div>
//       </section>

//       {/* SUPPLIER & PLUMBER CTA */}
//       <section className="bg-slate-900 py-14 sm:py-18 lg:py-20">
//         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-6 lg:grid-cols-2">
//           <motion.div
//             className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-6 sm:p-7"
//             initial={{ opacity: 0, y: 24 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//           >
//             <h3 className="text-lg sm:text-xl font-semibold text-emerald-100 mb-2">
//               🚚 Supply Water — Earn ₹3,000–8,000/month
//             </h3>
//             <p className="text-sm text-emerald-50/80 mb-4">
//               Use your vehicle and local routes to deliver water cans. We handle customers,
//               you focus on timely delivery.
//             </p>
//             <Link
//               href="/contact"
//               className="inline-flex items-center justify-center rounded-full bg-emerald-500 text-slate-900 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-400 transition"
//             >
//               Apply as Supplier →
//             </Link>
//           </motion.div>
//           <motion.div
//             className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-6 sm:p-7"
//             initial={{ opacity: 0, y: 24 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//           >
//             <h3 className="text-lg sm:text-xl font-semibold text-cyan-100 mb-2">
//               🔧 Work as Plumber — Earn ₹4,000–15,000/month
//             </h3>
//             <p className="text-sm text-cyan-50/80 mb-4">
//               Get regular jobs for fittings, repair, and boring. Transparent pricing and
//               instant payments via UPI.
//             </p>
//             <Link
//               href="/contact"
//               className="inline-flex items-center justify-center rounded-full bg-cyan-400 text-slate-900 px-5 py-2.5 text-sm font-semibold hover:bg-cyan-300 transition"
//             >
//               Apply as Plumber →
//             </Link>
//           </motion.div>
//         </div>
//       </section>

//       {/* FINAL TRUST & CTA */}
//       <section className="bg-slate-950 py-12 sm:py-16">
//         <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
//           <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-cyan-300">
//             Trusted by residents across North India
//           </p>
//           <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
//             Water shouldn&apos;t be a daily headache.
//           </h2>
//           <p className="mt-3 text-sm sm:text-base text-slate-300">
//             AuroWater keeps your cans filled, pumps running, and events flowing — so you
//             can focus on life, not logistics.
//           </p>
//           <div className="mt-6 flex flex-wrap justify-center gap-3">
//             <Link
//               href="/book"
//               className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#00BCD4] to-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-95 transition"
//             >
//               Start in 30 seconds →
//             </Link>
//             <Link
//               href="/pricing"
//               className="inline-flex items-center justify-center rounded-full border border-slate-500/60 px-6 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900 transition"
//             >
//               View transparent pricing
//             </Link>
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }





// 'use client';

// import Link from 'next/link';
// import React, { useEffect, useState, useRef, useCallback } from 'react';
// import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
// import { TRUST_REVIEWS } from '@/lib/trust-reviews';

// interface FoundingStats {
//   count: number;
// }

// /* ─── Animated water drop SVG background ─── */
// const WaterDropsBg = () => (
//   <svg
//     className="absolute inset-0 w-full h-full pointer-events-none"
//     xmlns="http://www.w3.org/2000/svg"
//     aria-hidden="true"
//   >
//     <defs>
//       <radialGradient id="drop1" cx="50%" cy="40%" r="60%">
//         <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
//         <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
//       </radialGradient>
//       <radialGradient id="drop2" cx="50%" cy="40%" r="60%">
//         <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.14" />
//         <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
//       </radialGradient>
//       <filter id="blur-soft">
//         <feGaussianBlur stdDeviation="3" />
//       </filter>
//     </defs>
//     {/* Large ambient orbs */}
//     <ellipse cx="10%" cy="30%" rx="340" ry="280" fill="url(#drop1)" filter="url(#blur-soft)" />
//     <ellipse cx="90%" cy="60%" rx="400" ry="320" fill="url(#drop2)" filter="url(#blur-soft)" />
//     <ellipse cx="50%" cy="100%" rx="600" ry="200" fill="url(#drop1)" filter="url(#blur-soft)" />
//   </svg>
// );

// /* ─── Animated water wave divider ─── */
// const WaveDivider = ({ flip = false, color = '#f8fafc' }: { flip?: boolean; color?: string }) => (
//   <div
//     className="w-full overflow-hidden leading-none"
//     style={{ transform: flip ? 'rotate(180deg)' : undefined, marginBottom: '-2px' }}
//   >
//     <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-12 sm:h-16">
//       <path
//         d="M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1380,20 1440,40 L1440,80 L0,80 Z"
//         fill={color}
//       />
//     </svg>
//   </div>
// );

// /* ─── Floating water drop particle ─── */
// const FloatingDrop = ({ x, delay, size, opacity }: { x: string; delay: number; size: number; opacity: number }) => (
//   <motion.div
//     className="absolute bottom-0 pointer-events-none"
//     style={{ left: x, opacity }}
//     animate={{ y: [0, -120, -240], opacity: [0, opacity, 0], scale: [0.5, 1, 0.3] }}
//     transition={{ duration: 4 + delay, delay, repeat: Infinity, ease: 'easeOut' }}
//   >
//     <svg width={size} height={size * 1.3} viewBox="0 0 20 26" fill="none">
//       <path d="M10 2 C10 2 2 12 2 17 a8 8 0 0 0 16 0 C18 12 10 2 10 2 Z" fill="#38bdf8" fillOpacity="0.7" />
//     </svg>
//   </motion.div>
// );

// /* ─── Stat counter animation ─── */
// const AnimatedStat = ({ value, suffix = '' }: { value: string; suffix?: string }) => {
//   const ref = useRef<HTMLSpanElement>(null);
//   const isInView = useInView(ref, { once: true });
//   const numericMatch = value.match(/\d+/);
//   const numeric = numericMatch ? parseInt(numericMatch[0]) : 0;
//   const prefix = value.replace(/[\d+]+/, '');
//   const [count, setCount] = useState(0);

//   useEffect(() => {
//     if (!isInView || !numeric) return;
//     let start = 0;
//     const end = numeric;
//     const duration = 1600;
//     const step = Math.ceil(end / (duration / 16));
//     const timer = setInterval(() => {
//       start += step;
//       if (start >= end) { setCount(end); clearInterval(timer); }
//       else setCount(start);
//     }, 16);
//     return () => clearInterval(timer);
//   }, [isInView, numeric]);

//   return (
//     <span ref={ref}>
//       {prefix}{isInView && numeric ? count : 0}{value.includes('+') ? '+' : ''}{suffix}
//     </span>
//   );
// };

// /* ─── Review card ─── */
// const ReviewCard = ({ r }: { r: typeof TRUST_REVIEWS[number] }) => (
//   <div className="min-w-[300px] max-w-[340px] rounded-2xl border border-sky-100 bg-white shadow-md px-5 py-5 flex-shrink-0">
//     <div className="flex items-center gap-3 mb-3">
//       <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${r.color} text-white flex items-center justify-center font-bold text-sm shadow`}>
//         {r.initials}
//       </div>
//       <div>
//         <div className="font-bold text-slate-900 text-sm leading-tight">{r.name}</div>
//         <div className="text-xs text-slate-500 mt-0.5">{r.city} · {r.date}</div>
//       </div>
//       <div className="ml-auto flex gap-0.5">
//         {Array.from({ length: 5 }).map((_, i) => (
//           <span key={i} className={i < r.rating ? 'text-amber-400' : 'text-slate-200'} style={{ fontSize: '11px' }}>★</span>
//         ))}
//       </div>
//     </div>
//     <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 mb-2">{r.service}</span>
//     <p className="text-sm text-slate-600 leading-relaxed italic">"{r.text}"</p>
//   </div>
// );

// export default function HomePage() {
//   const [founding, setFounding] = useState<FoundingStats | null>(null);
//   const [name, setName] = useState('');
//   const [phone, setPhone] = useState('');
//   const [foundingMsg, setFoundingMsg] = useState<string | null>(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [activeService, setActiveService] = useState(0);
//   const heroRef = useRef<HTMLDivElement>(null);
//   const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
//   const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
//   const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch('/api/founding-members', { cache: 'no-store' });
//         const json = await res.json();
//         if (json?.success) setFounding(json.data);
//       } catch { /* silent */ }
//     })();
//   }, []);

//   const claimed = Math.min(founding?.count ?? 73, 100);
//   const progress = (claimed / 100) * 100;

//   const handleFoundingSubmit = useCallback(async (e: React.FormEvent) => {
//     e.preventDefault();
//     setFoundingMsg(null);
//     if (!name.trim() || !phone.trim()) { setFoundingMsg('Please enter your name and phone.'); return; }
//     setSubmitting(true);
//     try {
//       const res = await fetch('/api/founding-members', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
//       });
//       const json = await res.json();
//       if (!res.ok || !json?.success) {
//         setFoundingMsg(json?.error || 'Could not save. Please try again.');
//       } else {
//         setFoundingMsg(json?.message || 'Welcome to the founding members! 🎉');
//         setName(''); setPhone('');
//         setFounding(prev => ({ count: (prev?.count ?? 0) + 1 }));
//       }
//     } catch { setFoundingMsg('Network error. Please try again.'); }
//     finally { setSubmitting(false); }
//   }, [name, phone]);

//   const services = [
//     {
//       icon: '💧', title: 'Water Delivery',
//       body: 'Daily cans ₹10–15 · Free doorstep delivery · Perfect for hostels, families & offices.',
//       cta: 'Order Now', href: '/book?service=water_tanker',
//       badge: 'Most Popular',
//       features: ['Real-time tracking', 'Free delivery', 'Cash + UPI'],
//     },
//     {
//       icon: '🔧', title: 'Plumber Service',
//       body: 'Fitting, boring, repair & pump installation by verified local plumbers.',
//       cta: 'Book Now', href: '/book?service=plumbing',
//       badge: 'Verified Pros',
//       features: ['Background checked', 'Fixed pricing', 'Same-day service'],
//     },
//     {
//       icon: '🚚', title: 'Bulk & Events',
//       body: 'Weddings, offices, construction, schools — cans, tankers & plumber teams on demand.',
//       cta: 'Get Quote', href: '/contact',
//       badge: 'Enterprise',
//       features: ['Custom volume', 'Dedicated team', 'Priority support'],
//     },
//   ];

//   const stats = [
//     { value: '500+', label: 'Daily Deliveries', icon: '💧' },
//     { value: '50+', label: 'Expert Plumbers', icon: '🔧' },
//     { value: '20+', label: 'Suppliers', icon: '🚛' },
//     { value: '4.8', label: 'Star Rating', icon: '⭐' },
//   ];

//   const roles = [
//     {
//       icon: '💧', title: 'I Need Water & Plumber',
//       desc: 'Order water, book plumbers, track deliveries. Sign up in 30 seconds.',
//       perks: ['Instant signup', 'No documents needed', 'Start ordering immediately'],
//       cta: 'Sign Up Free →', href: '/auth/register',
//       gradient: 'from-sky-500 to-cyan-400', color: 'sky',
//     },
//     {
//       icon: '🚛', title: 'I Supply Water',
//       desc: 'Partner with us to deliver water. Get verified and receive orders.',
//       perks: ['KYC verification', 'Admin approval', 'Start earning once approved'],
//       cta: 'Apply as Supplier →', href: '/auth/register?role=supplier',
//       gradient: 'from-emerald-500 to-teal-400', color: 'emerald',
//     },
//     {
//       icon: '🔧', title: "I'm a Plumber / Tech",
//       desc: 'Get verified, showcase your skills, and receive job requests.',
//       perks: ['Skill verification', 'Background check', 'Earn on your schedule'],
//       cta: 'Apply as Plumber →', href: '/auth/register?role=technician',
//       gradient: 'from-violet-500 to-purple-400', color: 'violet',
//     },
//   ];

//   return (
//     <div className="min-h-screen bg-slate-950 text-slate-50 overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif" }}>

//       {/* ═══════════════════════════════════════════════════
//           GOOGLE FONTS INJECT (Plus Jakarta Sans + DM Sans)
//       ═══════════════════════════════════════════════════ */}
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

//         /* ─── CSS Variables ─── */
//         :root {
//           --water-blue: #0ea5e9;
//           --water-deep: #0369a1;
//           --water-cyan: #22d3ee;
//           --water-teal: #14b8a6;
//           --emerald: #10b981;
//           --slate-950: #020617;
//         }

//         /* ─── Water shimmer animation ─── */
//         @keyframes shimmer {
//           0% { background-position: -200% center; }
//           100% { background-position: 200% center; }
//         }
//         @keyframes wave-slow {
//           0%, 100% { d: path("M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1380,20 1440,40 L1440,80 L0,80 Z"); }
//           50% { d: path("M0,60 C160,20 380,80 540,50 C700,20 920,70 1080,50 C1240,30 1360,60 1440,40 L1440,80 L0,80 Z"); }
//         }
//         @keyframes float-drop {
//           0%, 100% { transform: translateY(0px) scale(1); }
//           50% { transform: translateY(-18px) scale(1.05); }
//         }
//         @keyframes ripple-out {
//           0% { transform: scale(0.8); opacity: 0.8; }
//           100% { transform: scale(2.4); opacity: 0; }
//         }
//         @keyframes pulse-glow {
//           0%, 100% { box-shadow: 0 0 0 0 rgba(14,165,233,0.4); }
//           50% { box-shadow: 0 0 0 20px rgba(14,165,233,0); }
//         }
//         @keyframes marquee-left {
//           from { transform: translateX(0); }
//           to { transform: translateX(-50%); }
//         }
//         @keyframes marquee-right {
//           from { transform: translateX(-50%); }
//           to { transform: translateX(0); }
//         }
//         @keyframes gradient-shift {
//           0% { background-position: 0% 50%; }
//           50% { background-position: 100% 50%; }
//           100% { background-position: 0% 50%; }
//         }

//         .shimmer-text {
//           background: linear-gradient(90deg, #38bdf8 0%, #ffffff 40%, #22d3ee 60%, #38bdf8 100%);
//           background-size: 200% auto;
//           -webkit-background-clip: text;
//           -webkit-text-fill-color: transparent;
//           background-clip: text;
//           animation: shimmer 3s linear infinite;
//         }

//         .water-btn {
//           background: linear-gradient(135deg, #0ea5e9 0%, #22d3ee 50%, #10b981 100%);
//           background-size: 200% 200%;
//           animation: gradient-shift 3s ease infinite;
//           transition: transform 0.2s, box-shadow 0.2s;
//         }
//         .water-btn:hover {
//           transform: translateY(-2px);
//           box-shadow: 0 12px 35px rgba(14,165,233,0.45);
//         }
//         .water-btn:active { transform: translateY(0px); }

//         .glass-panel {
//           background: rgba(255,255,255,0.04);
//           backdrop-filter: blur(20px);
//           -webkit-backdrop-filter: blur(20px);
//           border: 1px solid rgba(255,255,255,0.1);
//         }
//         .glass-panel-light {
//           background: rgba(255,255,255,0.85);
//           backdrop-filter: blur(20px);
//           -webkit-backdrop-filter: blur(20px);
//           border: 1px solid rgba(14,165,233,0.15);
//         }

//         .card-hover {
//           transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
//         }
//         .card-hover:hover {
//           transform: translateY(-6px) scale(1.01);
//           box-shadow: 0 20px 50px rgba(14,165,233,0.15);
//         }

//         .float-drop { animation: float-drop 3.5s ease-in-out infinite; }

//         .marquee-track-left { animation: marquee-left 38s linear infinite; }
//         .marquee-track-right { animation: marquee-right 44s linear infinite; }
//         .marquee-track-left:hover,
//         .marquee-track-right:hover { animation-play-state: paused; }

//         .progress-bar-fill {
//           background: linear-gradient(90deg, #0ea5e9, #22d3ee, #10b981);
//           background-size: 200% 100%;
//           animation: shimmer 2s linear infinite;
//         }

//         .ripple-ring {
//           animation: ripple-out 2s ease-out infinite;
//         }
//         .ripple-ring:nth-child(2) { animation-delay: 0.7s; }
//         .ripple-ring:nth-child(3) { animation-delay: 1.4s; }

//         /* ─── Hero water background ─── */
//         .hero-mesh {
//           background:
//             radial-gradient(ellipse 80% 60% at 20% 20%, rgba(14,165,233,0.22) 0%, transparent 70%),
//             radial-gradient(ellipse 60% 50% at 80% 70%, rgba(6,182,212,0.18) 0%, transparent 70%),
//             radial-gradient(ellipse 40% 40% at 50% 100%, rgba(16,185,129,0.12) 0%, transparent 70%),
//             linear-gradient(160deg, #020c1b 0%, #041a2e 50%, #031320 100%);
//         }

//         /* ─── Scrollbar ─── */
//         ::-webkit-scrollbar { width: 6px; }
//         ::-webkit-scrollbar-track { background: #020617; }
//         ::-webkit-scrollbar-thumb { background: #0ea5e9; border-radius: 3px; }

//         /* ─── Responsive tweaks ─── */
//         @media (max-width: 640px) {
//           .marquee-track-left, .marquee-track-right {
//             animation-duration: 24s;
//           }
//         }
//       `}</style>

//       {/* ═══════════════════════════════════════════════════
//           HERO SECTION
//       ═══════════════════════════════════════════════════ */}
//       <section ref={heroRef} className="relative min-h-screen hero-mesh overflow-hidden flex flex-col">

//         {/* Water drop particles */}
//         <div className="absolute inset-0 pointer-events-none overflow-hidden">
//           {[
//             { x: '8%', delay: 0, size: 14, opacity: 0.5 },
//             { x: '22%', delay: 1.2, size: 10, opacity: 0.4 },
//             { x: '45%', delay: 2.5, size: 16, opacity: 0.6 },
//             { x: '65%', delay: 0.8, size: 12, opacity: 0.45 },
//             { x: '80%', delay: 3.1, size: 18, opacity: 0.5 },
//             { x: '92%', delay: 1.7, size: 10, opacity: 0.35 },
//           ].map((d, i) => <FloatingDrop key={i} {...d} />)}
//         </div>

//         {/* Animated SVG water rings */}
//         <div className="absolute top-16 right-8 sm:right-16 w-64 h-64 pointer-events-none">
//           <div className="relative w-full h-full flex items-center justify-center">
//             {[1,2,3].map(i => (
//               <div key={i} className="ripple-ring absolute rounded-full border-2 border-sky-400/30"
//                 style={{ width: `${i * 70}px`, height: `${i * 70}px` }} />
//             ))}
//             <div className="relative z-10 text-5xl float-drop">💧</div>
//           </div>
//         </div>

//         {/* Background SVG orbs */}
//         <WaterDropsBg />

//         {/* NAV */}
//         <nav className="relative z-20 flex items-center justify-between px-5 sm:px-8 lg:px-12 pt-5 pb-3">
//           <div className="flex items-center gap-2.5">
//             <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-lg" style={{ boxShadow: '0 4px 20px rgba(14,165,233,0.5)' }}>
//               <span className="text-lg">💧</span>
//             </div>
//             <div>
//               <span className="font-bold text-white text-lg tracking-tight">AuroWater</span>
//               <span className="ml-1.5 text-xs text-sky-400 font-medium hidden sm:inline">ऑन-डिमांड</span>
//             </div>
//           </div>
//           {/* <div className="hidden md:flex items-center gap-6 text-sm text-sky-100/80 font-medium">
//             <Link href="/book?service=water_tanker" className="hover:text-white transition">Order Water</Link>
//             <Link href="/book?service=plumbing" className="hover:text-white transition">Plumber</Link>
//             <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
//             <Link href="/contact" className="hover:text-white transition">Contact</Link>
//           </div> */}
//           <div className="flex items-center gap-2.5">
//             {/* <Link href="/auth/login" className="hidden sm:inline-flex text-xs font-semibold text-sky-200 hover:text-white transition px-3 py-1.5">Sign In</Link> */}
//             <Link href="/auth/register" className="water-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg">
//               Get Started →
//             </Link>
//           </div>
//         </nav>

//         {/* HERO CONTENT */}
//         <motion.div
//           className="relative z-10 flex-1 flex items-center"
//           style={{ y: heroY, opacity: heroOpacity }}
//         >
//           <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16 w-full">
//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

//               {/* Left col */}
//               <motion.div
//                 initial={{ opacity: 0, x: -40 }}
//                 animate={{ opacity: 1, x: 0 }}
//                 transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
//               >
//                 <motion.div
//                   initial={{ opacity: 0, y: 10 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   transition={{ delay: 0.15 }}
//                   className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 mb-5"
//                 >
//                   <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
//                   <span className="text-xs font-semibold text-sky-300 tracking-wide uppercase">Now live in Delhi & UP</span>
//                 </motion.div>

//                 <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-cyan-300 mb-4">
//                 AuroWater · ऑन-डिमांड पानी + प्लम्बर
//                </p>
               
//                 <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6">
//                   <span className="shimmer-text block">शुद्ध पानी। सीधे आपके दरवाज़े तक।</span>
//                   <span className="block text-white mt-1">Pure Water,</span>
//                   <span className="block text-sky-300 mt-1">At Your Door.</span>
//                 </h1>


//                 <p className="text-base sm:text-lg text-sky-100/70 max-w-lg mb-8 leading-relaxed font-light">
//                   On-demand water delivery + verified plumber service for students, families,
//                   offices & events — all in one simple app.
//                 </p>

//                 {/* CTA row */}
//                 <div className="flex flex-wrap gap-3 mb-10">
//                   <Link href="/book?service=water_tanker"
//                     className="water-btn inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-xl">
//                     💧 Order Water Now
//                   </Link>
//                   <Link href="/book?service=plumbing"
//                     className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-white/5 backdrop-blur px-7 py-3.5 text-sm font-bold text-sky-100 hover:bg-white/10 transition">
//                     🔧 Book a Plumber
//                   </Link>
//                 </div>

//                 {/* Hindi sub-line */}
//                 <p className="text-sm text-sky-200/60 font-medium">
//                   Cash + UPI · Hindi + English · 2hr Emergency Service
//                 </p>
//               </motion.div>

//               {/* Right col — Stats + card */}
//               <motion.div
//                 className="space-y-4"
//                 initial={{ opacity: 0, x: 40 }}
//                 animate={{ opacity: 1, x: 0 }}
//                 transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
//               >
//                 {/* Stats grid */}
//                 <div className="grid grid-cols-2 gap-3">
//                   {stats.map((s, i) => (
//                     <motion.div
//                       key={s.label}
//                       className="glass-panel rounded-2xl px-5 py-4"
//                       initial={{ opacity: 0, y: 20 }}
//                       animate={{ opacity: 1, y: 0 }}
//                       transition={{ delay: 0.3 + i * 0.08 }}
//                     >
//                       <div className="text-xl mb-1">{s.icon}</div>
//                       <div className="text-2xl font-extrabold text-white">
//                         <AnimatedStat value={s.value} />
//                       </div>
//                       <div className="text-xs text-sky-200/60 font-medium mt-0.5">{s.label}</div>
//                     </motion.div>
//                   ))}
//                 </div>

//                 {/* Feature card */}
//                 <div className="glass-panel rounded-2xl p-5">
//                   <div className="flex items-center gap-2 mb-3">
//                     <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
//                     <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">Why AuroWater</span>
//                   </div>
//                   <ul className="space-y-2.5">
//                     {[
//                       'Water cans at ₹10–15 with real-time availability',
//                       'Verified local suppliers & background-checked plumbers',
//                       'Emergency delivery in under 2 hours (select areas)',
//                       'Hindi + English support · Cash + UPI payments',
//                     ].map((item, i) => (
//                       <li key={i} className="flex items-start gap-2.5 text-sm text-sky-100/80">
//                         <span className="text-sky-400 mt-0.5 flex-shrink-0">✦</span>
//                         {item}
//                       </li>
//                     ))}
//                   </ul>
//                 </div>

//                 {/* Audience tags */}
//                 <div className="flex flex-wrap gap-2">
//                   {['👨‍🎓 Students & PG', '🏠 Families', '🏢 Offices', '🎪 Events'].map(tag => (
//                     <span key={tag} className="rounded-full border border-sky-400/25 bg-sky-400/8 px-3 py-1 text-xs font-medium text-sky-200">
//                       {tag}
//                     </span>
//                   ))}
//                 </div> 
//               </motion.div>
//             </div>
//           </div>
//         </motion.div>

//         {/* Wave bottom */}
//         <div className="relative z-10">
//           <WaveDivider color="#f8fafc" />
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           TRUST BADGES STRIP
//       ═══════════════════════════════════════════════════ */}
//       <section className="bg-slate-50 py-5 border-b border-slate-100">
//         <div className="max-w-5xl mx-auto px-5 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs sm:text-sm text-slate-600 font-semibold">
//           {['✅ Verified Suppliers', '🚀 Free Delivery Always', '💳 Cash + UPI', '🗣️ Hindi & English', '⚡ 2hr Emergency Response', '🔒 Phone Verified'].map(b => (
//             <span key={b} className="flex items-center gap-1">{b}</span>
//           ))}
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           THREE PATHS / ROLES
//       ═══════════════════════════════════════════════════ */}
//       <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
//         <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
//           <motion.div
//             className="text-center mb-12"
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//           >
//             <p className="text-xs font-bold tracking-widest text-sky-600 uppercase mb-3">Choose your role</p>
//             <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
//               Three paths —<br className="hidden sm:block" /> pick the one that fits you
//             </h2>
//           </motion.div>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
//             {roles.map((role, i) => (
//               <motion.div
//                 key={role.title}
//                 className="card-hover bg-white rounded-3xl p-7 shadow-sm border border-slate-100 flex flex-col"
//                 initial={{ opacity: 0, y: 30 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true }}
//                 transition={{ delay: i * 0.1 }}
//               >
//                 <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center text-2xl mb-5 shadow-lg`}>
//                   {role.icon}
//                 </div>
//                 <h3 className="text-lg font-extrabold text-slate-900 mb-2">{role.title}</h3>
//                 <p className="text-sm text-slate-500 mb-5 leading-relaxed">{role.desc}</p>
//                 <ul className="space-y-2 mb-7 flex-1">
//                   {role.perks.map(p => (
//                     <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
//                       <span className="text-emerald-500 font-bold">✓</span> {p}
//                     </li>
//                   ))}
//                 </ul>
//                 <Link
//                   href={role.href}
//                   className={`inline-flex items-center justify-center w-full rounded-2xl bg-gradient-to-r ${role.gradient} text-white px-6 py-3.5 text-sm font-bold shadow hover:opacity-90 transition`}
//                 >
//                   {role.cta}
//                 </Link>
//               </motion.div>
//             ))}
//           </div>

//           <p className="mt-8 text-center text-sm text-slate-500">
//             🛡️ All accounts are phone-verified. Suppliers & plumbers undergo KYC before activation.
//           </p>
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           INTERACTIVE SERVICES SHOWCASE
//       ═══════════════════════════════════════════════════ */}
//       <div className="bg-white">
//         <WaveDivider flip color="#020617" />
//       </div>
//       <section className="bg-slate-950 py-16 sm:py-20 lg:py-24 relative overflow-hidden">
//         {/* subtle grid bg */}
//         <div className="absolute inset-0 opacity-5 pointer-events-none"
//           style={{ backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

//         <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
//           <motion.div
//             className="text-center mb-12"
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//           >
//             <p className="text-xs font-bold tracking-widest text-sky-400 uppercase mb-3">What we offer</p>
//             <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
//               Services for every water need
//             </h2>
//           </motion.div>

//           {/* Service tabs */}
//           <div className="flex justify-center gap-2 mb-10 flex-wrap">
//             {services.map((s, i) => (
//               <button
//                 key={s.title}
//                 onClick={() => setActiveService(i)}
//                 className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
//                   activeService === i
//                     ? 'bg-sky-500 text-white shadow-lg'
//                     : 'border border-sky-500/30 text-sky-300 hover:bg-sky-500/10'
//                 }`}
//               >
//                 {s.icon} {s.title}
//               </button>
//             ))}
//           </div>

//           <AnimatePresence mode="wait">
//             <motion.div
//               key={activeService}
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -20 }}
//               transition={{ duration: 0.35 }}
//               className="glass-panel rounded-3xl p-8 sm:p-10 max-w-3xl mx-auto"
//             >
//               <div className="flex items-start gap-6">
//                 <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center text-3xl flex-shrink-0">
//                   {services[activeService].icon}
//                 </div>
//                 <div className="flex-1">
//                   <div className="flex items-center gap-3 mb-2">
//                     <h3 className="text-xl font-extrabold text-white">{services[activeService].title}</h3>
//                     <span className="rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-bold px-3 py-0.5">
//                       {services[activeService].badge}
//                     </span>
//                   </div>
//                   <p className="text-sky-100/70 text-base mb-5">{services[activeService].body}</p>
//                   <div className="flex flex-wrap gap-2 mb-6">
//                     {services[activeService].features.map(f => (
//                       <span key={f} className="flex items-center gap-1.5 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-3 py-1 font-medium">
//                         <span className="text-emerald-400">✓</span> {f}
//                       </span>
//                     ))}
//                   </div>
//                   <Link
//                     href={services[activeService].href}
//                     className="water-btn inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-white shadow-lg"
//                   >
//                     {services[activeService].cta} →
//                   </Link>
//                 </div>
//               </div>
//             </motion.div>
//           </AnimatePresence>

//           {/* Dots */}
//           <div className="flex justify-center gap-2 mt-6">
//             {services.map((_, i) => (
//               <button key={i} onClick={() => setActiveService(i)}
//                 className={`w-2 h-2 rounded-full transition-all ${i === activeService ? 'bg-sky-400 w-6' : 'bg-sky-700'}`} />
//             ))}
//           </div>
//         </div>

//         <div className="mt-16">
//           <WaveDivider color="#f8fafc" />
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           WHY AUROWATER — 4 PILLARS
//       ═══════════════════════════════════════════════════ */}
//       <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
//         <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
//           <motion.div
//             className="text-center mb-12"
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//           >
//             <p className="text-xs font-bold tracking-widest text-sky-600 uppercase mb-3">Our promise</p>
//             <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Why AuroWater</h2>
//           </motion.div>

//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
//             {[
//               { icon: '⚡', title: 'Same-day Service', desc: 'Book by 2PM, get service today in most areas.', color: 'amber' },
//               { icon: '💰', title: 'No Hidden Charges', desc: 'Price shown = Price paid. Every single time.', color: 'emerald' },
//               { icon: '✅', title: 'Verified Pros', desc: 'Every technician background-checked & ID-verified.', color: 'sky' },
//               { icon: '📱', title: 'Easy Tracking', desc: 'Real-time updates from booking to completion.', color: 'violet' },
//             ].map((f, i) => (
//               <motion.div
//                 key={f.title}
//                 className="card-hover bg-white rounded-3xl p-6 shadow-sm border border-slate-100"
//                 initial={{ opacity: 0, y: 30 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true }}
//                 transition={{ delay: i * 0.1 }}
//               >
//                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-4
//                   ${f.color === 'amber' ? 'bg-amber-50 text-amber-500' :
//                     f.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' :
//                     f.color === 'sky' ? 'bg-sky-50 text-sky-500' : 'bg-violet-50 text-violet-500'}
//                 `}>
//                   {f.icon}
//                 </div>
//                 <h3 className="font-extrabold text-slate-900 mb-2">{f.title}</h3>
//                 <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           WHO WE SERVE
//       ═══════════════════════════════════════════════════ */}
//       <section className="bg-white py-14 sm:py-16">
//         <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12">
//           <motion.h2
//             className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//           >
//             Who we serve
//           </motion.h2>
//           <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
//             {[
//               { icon: '👨‍🎓', label: 'Students & PG' },
//               { icon: '👨‍💼', label: 'Professionals' },
//               { icon: '🏠', label: 'Homeowners' },
//               { icon: '🏢', label: 'Offices' },
//               { icon: '🎪', label: 'Weddings' },
//               { icon: '🍽️', label: 'Restaurants' },
//               { icon: '🏗️', label: 'Construction' },
//               { icon: '🏫', label: 'Schools' },
//             ].map((item, i) => (
//               <motion.div
//                 key={item.label}
//                 className="card-hover flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4 text-center cursor-default"
//                 initial={{ opacity: 0, scale: 0.9 }}
//                 whileInView={{ opacity: 1, scale: 1 }}
//                 viewport={{ once: true }}
//                 transition={{ delay: i * 0.05 }}
//               >
//                 <span className="text-2xl">{item.icon}</span>
//                 <span className="text-xs sm:text-sm font-semibold text-slate-700">{item.label}</span>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           REVIEWS MARQUEE
//       ═══════════════════════════════════════════════════ */}
//       <section className="bg-slate-50 py-14 sm:py-18 overflow-hidden">
//         <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
//           <motion.div
//             className="text-center mb-10"
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//           >
//             <p className="text-xs font-bold tracking-widest text-sky-600 uppercase mb-3">Social proof</p>
//             <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Trusted by customers</h2>
//             <p className="text-slate-500 mt-2">Real experiences from people across UP.</p>
//           </motion.div>

//           <div className="space-y-5">
//             {[
//               { cls: 'marquee-track-left', set: [...TRUST_REVIEWS, ...TRUST_REVIEWS] },
//               { cls: 'marquee-track-right', set: [...TRUST_REVIEWS].reverse().concat([...TRUST_REVIEWS].reverse()) },
//             ].map((row, ri) => (
//               <div key={ri} className="overflow-hidden">
//                 <div className={`flex gap-4 ${row.cls}`}>
//                   {row.set.map((r, idx) => <ReviewCard key={`${r.name}-${ri}-${idx}`} r={r} />)}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           HOW IT WORKS
//       ═══════════════════════════════════════════════════ */}
//       <div className="bg-slate-50">
//         <WaveDivider flip color="#020617" />
//       </div>
//       <section className="bg-slate-950 py-16 sm:py-20 lg:py-24 relative overflow-hidden">
//         <div className="absolute inset-0 opacity-5 pointer-events-none"
//           style={{ backgroundImage: 'linear-gradient(rgba(14,165,233,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

//         <div className="relative max-w-5xl mx-auto px-5 sm:px-8 lg:px-12">
//           <motion.div
//             className="text-center mb-12"
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//           >
//             <p className="text-xs font-bold tracking-widest text-sky-400 uppercase mb-3">Simple process</p>
//             <h2 className="text-3xl sm:text-4xl font-extrabold text-white">How it works</h2>
//           </motion.div>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
//             {/* connector line */}
//             <div className="hidden md:block absolute top-10 left-[calc(33.33%-1rem)] right-[calc(33.33%-1rem)] h-0.5 bg-gradient-to-r from-sky-500/50 via-cyan-400/50 to-emerald-500/50" />

//             {[
//               { step: '01', icon: '📱', title: 'Order in 30 sec', body: 'Pick water or plumber, add your address, select a time slot.' },
//               { step: '02', icon: '🚚', title: 'Auto-assignment', body: 'Nearest verified supplier or plumber is assigned instantly.' },
//               { step: '03', icon: '✅', title: 'Done — pay easy', body: 'Track live, pay on completion via cash or UPI, rate your experience.' },
//             ].map((item, i) => (
//               <motion.div
//                 key={item.step}
//                 className="glass-panel rounded-3xl p-7 flex flex-col items-center text-center"
//                 initial={{ opacity: 0, y: 30 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true }}
//                 transition={{ delay: i * 0.12 }}
//               >
//                 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center text-2xl mb-4 shadow-lg z-10">
//                   {item.icon}
//                 </div>
//                 <div className="text-xs font-extrabold text-sky-400 tracking-widest mb-2">{item.step}</div>
//                 <h3 className="text-base font-extrabold text-white mb-2">{item.title}</h3>
//                 <p className="text-sm text-slate-300/80 leading-relaxed">{item.body}</p>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//         <div className="mt-16"><WaveDivider color="#f8fafc" /></div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           FOUNDING MEMBERS
//       ═══════════════════════════════════════════════════ */}
//       <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
//         <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
//           <div className="grid lg:grid-cols-[1.3fr,1fr] gap-10 items-center">
//             <motion.div
//               initial={{ opacity: 0, x: -30 }}
//               whileInView={{ opacity: 1, x: 0 }}
//               viewport={{ once: true }}
//             >
//               <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 mb-5">
//                 <span className="text-amber-500">🔥</span>
//                 <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Limited spots</span>
//               </div>
//               <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
//                 Join Our First<br />
//                 <span className="text-sky-600">100 Founding Members</span>
//               </h2>
//               <p className="text-base text-slate-600 mb-5 leading-relaxed">
//                 पहले 100 customers में शामिल हों और हमेशा के लिए बेहतर पानी और प्रायोरिटी सर्विस पाएं।
//               </p>
//               <ul className="space-y-2.5 mb-7">
//                 {[
//                   { icon: '🔒', text: 'Lifetime 10% discount on water and services' },
//                   { icon: '⚡', text: 'Always priority delivery window' },
//                   { icon: '🎁', text: 'First order free (up to ₹200)' },
//                   { icon: '📞', text: 'Direct WhatsApp support with the core team' },
//                 ].map(item => (
//                   <li key={item.text} className="flex items-center gap-3 text-sm text-slate-700">
//                     <span className="text-base">{item.icon}</span> {item.text}
//                   </li>
//                 ))}
//               </ul>

//               <div className="mb-2 flex justify-between text-sm font-semibold">
//                 <span className="text-slate-700">{claimed} of 100 spots claimed</span>
//                 <span className="text-sky-600">{100 - claimed} remaining</span>
//               </div>
//               <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
//                 <div className="h-full rounded-full progress-bar-fill transition-[width] duration-700"
//                   style={{ width: `${progress}%` }} />
//               </div>
//               <p className="text-xs text-slate-400">We'll confirm your spot by SMS/WhatsApp within 24h.</p>
//             </motion.div>

//             <motion.div
//               className="glass-panel-light rounded-3xl p-7 sm:p-8 shadow-xl"
//               initial={{ opacity: 0, x: 30 }}
//               whileInView={{ opacity: 1, x: 0 }}
//               viewport={{ once: true }}
//             >
//               <h3 className="text-xl font-extrabold text-slate-900 mb-5">Reserve your spot</h3>
//               <form onSubmit={handleFoundingSubmit} className="space-y-4">
//                 <div>
//                   <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name</label>
//                   <input
//                     type="text" value={name} onChange={e => setName(e.target.value)}
//                     className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
//                     placeholder="e.g. Arjun Singh" required
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Phone (WhatsApp)</label>
//                   <input
//                     type="tel" value={phone} onChange={e => setPhone(e.target.value)}
//                     className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
//                     placeholder="10-digit Indian mobile" required
//                   />
//                 </div>
//                 <button
//                   type="submit" disabled={submitting}
//                   className="water-btn w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
//                 >
//                   {submitting ? '⏳ Saving…' : 'Join the first 100 →'}
//                 </button>
//                 {foundingMsg && (
//                   <motion.p
//                     initial={{ opacity: 0, y: 6 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     className={`text-sm text-center font-medium ${foundingMsg.includes('Welcome') ? 'text-emerald-600' : 'text-red-500'}`}
//                   >
//                     {foundingMsg}
//                   </motion.p>
//                 )}
//               </form>
//             </motion.div>
//           </div>
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           SUPPLIER & PLUMBER CTA
//       ═══════════════════════════════════════════════════ */}
//       <div className="bg-slate-50">
//         <WaveDivider flip color="#020617" />
//       </div>
//       <section className="bg-slate-950 py-16 sm:py-20">
//         <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
//           <motion.h2
//             className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-8"
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//           >
//             Earn with AuroWater
//           </motion.h2>
//           <div className="grid md:grid-cols-2 gap-5">
//             {[
//               {
//                 icon: '🚚',
//                 title: 'Supply Water',
//                 earn: '₹3,000–8,000/month',
//                 desc: 'Use your vehicle and local routes to deliver water cans. We handle customers — you focus on timely delivery.',
//                 cta: 'Apply as Supplier →',
//                 href: '/contact',
//                 border: 'border-emerald-400/30',
//                 bg: 'bg-emerald-500/8',
//                 btn: 'bg-gradient-to-r from-emerald-500 to-teal-400',
//                 text: 'text-emerald-100',
//               },
//               {
//                 icon: '🔧',
//                 title: 'Work as Plumber',
//                 earn: '₹4,000–15,000/month',
//                 desc: 'Get regular jobs for fittings, repair & boring. Transparent pricing and instant UPI payments.',
//                 cta: 'Apply as Plumber →',
//                 href: '/contact',
//                 border: 'border-sky-400/30',
//                 bg: 'bg-sky-500/8',
//                 btn: 'bg-gradient-to-r from-sky-500 to-cyan-400',
//                 text: 'text-sky-100',
//               },
//             ].map(c => (
//               <motion.div
//                 key={c.title}
//                 className={`rounded-3xl border ${c.border} ${c.bg} p-7 sm:p-8 backdrop-blur`}
//                 initial={{ opacity: 0, y: 24 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true }}
//               >
//                 <div className="text-3xl mb-3">{c.icon}</div>
//                 <h3 className={`text-xl font-extrabold mb-1 ${c.text}`}>{c.title}</h3>
//                 <div className="text-2xl font-extrabold text-white mb-3">{c.earn}</div>
//                 <p className={`text-sm mb-5 leading-relaxed ${c.text} opacity-80`}>{c.desc}</p>
//                 <Link
//                   href={c.href}
//                   className={`inline-flex items-center justify-center rounded-full ${c.btn} text-white px-6 py-3 text-sm font-bold shadow hover:opacity-90 transition`}
//                 >
//                   {c.cta}
//                 </Link>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           FINAL CTA
//       ═══════════════════════════════════════════════════ */}
//       <section className="relative bg-slate-950 py-16 sm:py-20 overflow-hidden">
//         {/* water drops */}
//         <div className="absolute inset-0 pointer-events-none">
//           <WaterDropsBg />
//         </div>
//         <div className="relative max-w-4xl mx-auto px-5 sm:px-8 text-center">
//           <motion.div
//             initial={{ opacity: 0, y: 24 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//           >
//             <p className="text-xs font-bold tracking-widest text-sky-400 uppercase mb-4">Trusted across North India</p>
//             <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
//               Water shouldn't be<br className="hidden sm:block" /> a daily headache.
//             </h2>
//             <p className="text-base sm:text-lg text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
//               AuroWater keeps your cans filled, pumps running, and events flowing — so you can focus on life, not logistics.
//             </p>
//             <div className="flex flex-wrap justify-center gap-3">
//               <Link
//                 href="/book"
//                 className="water-btn inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-extrabold text-white shadow-xl"
//               >
//                 💧 Start in 30 seconds →
//               </Link>
//               <Link
//                 href="/pricing"
//                 className="inline-flex items-center justify-center rounded-full border border-slate-500/60 bg-white/5 px-8 py-4 text-base font-bold text-slate-100 hover:bg-white/10 transition backdrop-blur"
//               >
//                 View transparent pricing
//               </Link>
//             </div>
//           </motion.div>
//         </div>
//       </section>

//       {/* ═══════════════════════════════════════════════════
//           FOOTER
//       ═══════════════════════════════════════════════════ */}
//       <footer className="bg-slate-950 border-t border-slate-800/60 py-10">
//         <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
//           <div className="flex items-center gap-2">
//             <span className="text-lg">💧</span>
//             <span className="font-bold text-slate-300">AuroWater</span>
//             <span className="text-slate-600">· Delhi, UP</span>
//           </div>
//           <div className="flex flex-wrap justify-center gap-5">
//             <Link href="/pricing" className="hover:text-slate-300 transition">Pricing</Link>
//             <Link href="/contact" className="hover:text-slate-300 transition">Contact</Link>
//             <Link href="/auth/register?role=supplier" className="hover:text-slate-300 transition">Become Supplier</Link>
//             <Link href="/auth/register?role=technician" className="hover:text-slate-300 transition">Become Plumber</Link>
//           </div>
//           <p className="text-xs text-slate-600">© {new Date().getFullYear()} AuroWater. All rights reserved.</p>
//         </div>
//       </footer>
//     </div>
//   );
// }





'use client';

import Link from 'next/link';
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { TRUST_REVIEWS } from '@/lib/trust-reviews';

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
interface FoundingStats { count: number }

interface ServiceItem {
  icon: string;
  title: string;
  badge: string;
  body: string;
  cta: string;
  href: string;
  features: string[];
  accent: string;
  accentBg: string;
}

/* ═══════════════════════════════════════════════════
   STATIC DATA  (outside component — stable references, zero re-alloc)
═══════════════════════════════════════════════════ */
const SERVICES: ServiceItem[] = [
  {
    icon: '💧', title: 'Water Delivery', badge: 'Most Popular',
    body: 'Daily cans ₹10–15 · Free doorstep delivery · Perfect for hostels, families & offices.',
    cta: 'Order Now', href: '/book',
    features: ['Real-time tracking', 'Always free delivery', 'Cash + UPI'],
    accent: '#0ea5e9', accentBg: 'rgba(14,165,233,0.13)',
  },
  {
    icon: '🔧', title: 'Plumber Service', badge: 'Verified Pros',
    body: 'Fitting, boring, repair & pump installation by verified, background-checked local plumbers.',
    cta: 'Book Now', href: '/book',
    features: ['Background checked', 'Fixed pricing', 'Same-day service'],
    accent: '#6366f1', accentBg: 'rgba(99,102,241,0.13)',
  },
  {
    icon: '🚚', title: 'Bulk & Events', badge: 'Enterprise',
    body: 'Weddings, offices, construction, schools — cans, tankers & plumber teams on demand.',
    cta: 'Get Quote', href: '/contact',
    features: ['Custom volume', 'On-site team', 'Priority support'],
    accent: '#10b981', accentBg: 'rgba(16,185,129,0.13)',
  },
];

const STATS = [
  { value: '500', suffix: '+', label: 'Daily Deliveries', icon: '💧', glow: '#0ea5e9' },
  { value: '50',  suffix: '+', label: 'Expert Plumbers',  icon: '🔧', glow: '#6366f1' },
  { value: '20',  suffix: '+', label: 'Suppliers',        icon: '🚛', glow: '#10b981' },
  { value: '4.8', suffix: '',  label: 'Star Rating',      icon: '⭐', glow: '#f59e0b' },
] as const;

const ROLES = [
  {
    icon: '💧', title: 'I Need Water & Plumber',
    desc: 'Order water, book plumbers, track deliveries. Sign up in 30 seconds.',
    perks: ['Instant signup', 'No documents needed', 'Start ordering immediately'],
    cta: 'Sign Up Free →', href: '/auth/register',
    gradient: 'from-sky-500 to-cyan-400', shadow: 'rgba(14,165,233,0.35)',
  },
  {
    icon: '🚛', title: 'I Supply Water',
    desc: 'Partner with us to deliver water. Get verified and receive orders directly.',
    perks: ['KYC verification', 'Admin approval process', 'Start earning once approved'],
    cta: 'Apply as Supplier →', href: '/register/pro?type=supplier',
    gradient: 'from-emerald-500 to-teal-400', shadow: 'rgba(16,185,129,0.35)',
  },
  {
    icon: '🔧', title: "I'm a Plumber / Tech",
    desc: 'Get verified, showcase your skills, and receive job requests from customers.',
    perks: ['Skill verification', 'Background check', 'Earn on your schedule'],
    cta: 'Apply as Plumber →', href: '/register/pro?type=technician',
    gradient: 'from-violet-500 to-purple-400', shadow: 'rgba(139,92,246,0.35)',
  },
] as const;

const WHY_CARDS = [
  { icon: '⚡', title: 'Same-day Service',    desc: 'Book by 2 PM, get service today in most areas.',           accent: '#f59e0b' },
  { icon: '💰', title: 'No Hidden Charges',   desc: 'Price shown = Price paid. Every single time, guaranteed.', accent: '#10b981' },
  { icon: '✅', title: 'Verified Pros',        desc: 'Every technician background-checked & ID-verified.',       accent: '#0ea5e9' },
  { icon: '📱', title: 'Live Tracking',        desc: 'Real-time updates from booking all the way to delivery.',  accent: '#8b5cf6' },
] as const;

const TRUST_BADGES = [
  '✅ Verified Suppliers', '🚀 Free Delivery Always', '💳 Cash + UPI',
  '🗣️ Hindi & English', '⚡ 2hr Emergency', '🔒 Phone Verified',
] as const;

const SERVE_ITEMS = [
  { icon: '👨‍🎓', label: 'Students & PG' }, { icon: '👨‍💼', label: 'Professionals' },
  { icon: '🏠',   label: 'Homeowners' },    { icon: '🏢',   label: 'Offices' },
  { icon: '🎪',   label: 'Weddings' },      { icon: '🍽️',  label: 'Restaurants' },
  { icon: '🏗️',  label: 'Construction' },  { icon: '🏫',   label: 'Schools' },
] as const;

const EARN_CARDS = [
  {
    icon: '🚚', title: 'Supply Water', earn: '₹3,000–8,000/mo', earnColor: '#34d399',
    desc: 'Use your vehicle and local routes to deliver water cans. We handle customers — you focus on timely delivery.',
    cta: 'Apply as Supplier →', href: '/register/pro?type=supplier',
    borderColor: 'rgba(16,185,129,0.3)', bgColor: 'rgba(16,185,129,0.06)',
    btnClass: 'from-emerald-500 to-teal-400',
  },
  {
    icon: '🔧', title: 'Work as Plumber', earn: '₹4,000–15,000/mo', earnColor: '#38bdf8',
    desc: 'Get regular jobs for fittings, repair & boring. Transparent pricing and instant UPI payments.',
    cta: 'Apply as Plumber →', href: '/register/pro?type=technician',
    borderColor: 'rgba(14,165,233,0.3)', bgColor: 'rgba(14,165,233,0.06)',
    btnClass: 'from-sky-500 to-cyan-400',
  },
] as const;

const STEPS = [
  {
    n: '01', icon: '📱', title: 'Order in 30 sec',
    body: 'Pick water or plumber, add your address, choose a time slot. Done in under a minute.',
  },
  {
    n: '02', icon: '🚚', title: 'Auto-assignment',
    body: 'Nearest verified supplier or plumber is assigned automatically and notified instantly.',
  },
  {
    n: '03', icon: '✅', title: 'Done — pay easy',
    body: 'Track live on the map, pay via cash or UPI on completion, then rate your experience.',
  },
] as const;

const FOUNDING_PERKS = [
  { icon: '🔒', t: 'Lifetime 10% discount on water and services' },
  { icon: '⚡', t: 'Always priority delivery window' },
  { icon: '🎁', t: 'First order free (up to ₹200)' },
  { icon: '📞', t: 'Direct WhatsApp support with the core team' },
] as const;

const DROPS_CONFIG = [
  { left: '7%',  duration: 5.2, delay: 0,   size: 13 },
  { left: '19%', duration: 6.8, delay: 1.3, size: 9  },
  { left: '33%', duration: 4.9, delay: 2.6, size: 16 },
  { left: '51%', duration: 7.1, delay: 0.9, size: 11 },
  { left: '67%', duration: 5.6, delay: 3.4, size: 14 },
  { left: '81%', duration: 6.2, delay: 1.8, size: 10 },
  { left: '93%', duration: 4.6, delay: 0.5, size: 12 },
] as const;

/* ═══════════════════════════════════════════════════
   PURE SUB-COMPONENTS  (stable — no parent re-renders leak in)
═══════════════════════════════════════════════════ */

const WaveDivider = React.memo(function WaveDivider({
  flip = false, color = '#f8fafc',
}: { flip?: boolean; color?: string }) {
  return (
    <div
      className="w-full overflow-hidden leading-none pointer-events-none"
      style={{ transform: flip ? 'rotate(180deg)' : undefined, marginBottom: '-2px' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none" className="w-full h-10 sm:h-14" style={{ display: 'block' }}>
        <path
          d="M0,40 C200,80 400,0 600,40 C800,80 1000,0 1200,40 C1300,64 1380,20 1440,40 L1440,80 L0,80 Z"
          fill={color}
        />
      </svg>
    </div>
  );
});
WaveDivider.displayName = 'WaveDivider';

const HeroGlowOrbs = React.memo(function HeroGlowOrbs() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="aw-orb1" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#0ea5e9" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="aw-orb2" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
        </radialGradient>
        <filter id="aw-blur"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <ellipse cx="12%"  cy="28%" rx="360" ry="300" fill="url(#aw-orb1)" filter="url(#aw-blur)" />
      <ellipse cx="88%"  cy="62%" rx="420" ry="340" fill="url(#aw-orb2)" filter="url(#aw-blur)" />
      <ellipse cx="50%"  cy="102%" rx="640" ry="220" fill="url(#aw-orb1)" filter="url(#aw-blur)" />
    </svg>
  );
});
HeroGlowOrbs.displayName = 'HeroGlowOrbs';

const RisingDrop = React.memo(function RisingDrop({
  left, duration, delay, size,
}: { left: string; duration: number; delay: number; size: number }) {
  return (
    <motion.div
      className="absolute bottom-4 pointer-events-none"
      style={{ left }}
      initial={{ y: 0, opacity: 0, scale: 0.4 }}
      animate={{ y: [0, -160, -320], opacity: [0, 0.65, 0], scale: [0.4, 1, 0.25] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <svg width={size} height={size * 1.35} viewBox="0 0 20 27" fill="none">
        <path d="M10 1.5C10 1.5 1.5 12 1.5 17.5a8.5 8.5 0 0017 0C18.5 12 10 1.5 10 1.5z"
          fill="#38bdf8" fillOpacity="0.62" />
      </svg>
    </motion.div>
  );
});
RisingDrop.displayName = 'RisingDrop';

const CountUp = React.memo(function CountUp({
  target, suffix, isDecimal,
}: { target: number; suffix: string; isDecimal: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame = 0;
    const totalFrames = 72;
    const tick = () => {
      frame++;
      const eased = 1 - Math.pow(1 - frame / totalFrames, 3);
      setCount(eased * target);
      if (frame < totalFrames) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {isDecimal ? count.toFixed(1) : Math.floor(count)}{suffix}
    </span>
  );
});
CountUp.displayName = 'CountUp';

const ReviewCard = React.memo(function ReviewCard({
  r,
}: { r: (typeof TRUST_REVIEWS)[number] }) {
  return (
    <div className="aw-review-card flex-shrink-0 min-w-[292px] max-w-[316px] rounded-2xl bg-white border border-slate-100 shadow-sm px-5 py-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${r.color} text-white flex items-center justify-center font-bold text-xs shadow`}>
          {r.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 text-sm truncate">{r.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{r.city} · {r.date}</div>
        </div>
        <div className="flex gap-px flex-shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={i < r.rating ? 'text-amber-400' : 'text-slate-200'} style={{ fontSize: 11 }}>★</span>
          ))}
        </div>
      </div>
      <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 mb-2.5">
        {r.service}
      </span>
      <p className="text-sm text-slate-600 leading-relaxed italic">"{r.text}"</p>
    </div>
  );
});
ReviewCard.displayName = 'ReviewCard';

/* ═══════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════ */
export default function HomePage() {
  const [founding, setFounding]       = useState<FoundingStats | null>(null);
  const [formName, setFormName]       = useState('');
  const [formPhone, setFormPhone]     = useState('');
  const [foundingMsg, setFoundingMsg] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [activeSvc, setActiveSvc]     = useState(0);
  const [deliveredTarget, setDeliveredTarget] = useState<number | null>(null);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [customersTarget, setCustomersTarget] = useState<number | null>(null);
  const [customersCount, setCustomersCount] = useState(0);
  const [suppliersTarget, setSuppliersTarget] = useState<number | null>(null);
  const [suppliersCount, setSuppliersCount] = useState(0);

  const heroRef = useRef<HTMLElement>(null);

  /* ── Parallax ── */
  const { scrollYProgress } = useScroll({
    target: heroRef, offset: ['start start', 'end start'],
  });
  const heroY       = useTransform(scrollYProgress, [0, 1], ['0%', '28%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  /* ── Custom cursor ── */
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const springX = useSpring(cursorX, { stiffness: 500, damping: 38 });
  const springY = useSpring(cursorY, { stiffness: 500, damping: 38 });
  useEffect(() => {
    const move = (e: MouseEvent) => { cursorX.set(e.clientX - 12); cursorY.set(e.clientY - 12); };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [cursorX, cursorY]);

  /* ── Footer handoff: home ends in #08111F gradient so the global Footer bridge has no harsh seam ── */
  useEffect(() => {
    document.documentElement.style.setProperty('--footer-prev-bg', '#08111F');
    return () => {
      document.documentElement.style.setProperty('--footer-prev-bg', '#ffffff');
    };
  }, []);

  /* ── Founding count ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch('/api/founding-members', { cache: 'no-store' });
        const json = (await res.json()) as { success: boolean; data: FoundingStats };
        if (!cancelled && json?.success) setFounding(json.data);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Live counters (public stats) ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stats', { cache: 'force-cache' });
        if (!res.ok) return;
        const json = (await res.json()) as {
          completed_orders?: number;
          total_customers?: number;
          active_suppliers?: number;
        };
        const completed = Math.max(0, Math.floor(Number(json.completed_orders ?? 0)));
        const customers = Math.max(0, Math.floor(Number(json.total_customers ?? 0)));
        const suppliers = Math.max(0, Math.floor(Number(json.active_suppliers ?? 0)));
        if (!cancelled) {
          setDeliveredTarget(completed);
          setCustomersTarget(customers);
          setSuppliersTarget(suppliers);
        }
      } catch {
        /* best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (deliveredTarget == null) return;
    const start = performance.now();
    const duration = 1500;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDeliveredCount(Math.round(deliveredTarget * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setDeliveredCount(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deliveredTarget]);

  useEffect(() => {
    if (customersTarget == null) return;
    const start = performance.now();
    const duration = 1500;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setCustomersCount(Math.round(customersTarget * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setCustomersCount(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [customersTarget]);

  useEffect(() => {
    if (suppliersTarget == null) return;
    const start = performance.now();
    const duration = 1500;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setSuppliersCount(Math.round(suppliersTarget * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setSuppliersCount(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [suppliersTarget]);

  const claimed  = useMemo(() => Math.min(founding?.count ?? 73, 100), [founding]);
  const progress = useMemo(() => (claimed / 100) * 100, [claimed]);

  /* ── Doubled review arrays (stable) ── */
  const reviewsLeft  = useMemo(() => [...TRUST_REVIEWS, ...TRUST_REVIEWS], []);
  const reviewsRight = useMemo(
    () => [...TRUST_REVIEWS].reverse().concat([...TRUST_REVIEWS].reverse()),
    []
  );

  /* ── Form submit ── */
  const handleFoundingSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFoundingMsg(null);
      if (!formName.trim() || !formPhone.trim()) {
        setFoundingMsg('Please enter your name and phone.');
        return;
      }
      setSubmitting(true);
      try {
        const res  = await fetch('/api/founding-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim(), phone: formPhone.trim() }),
        });
        const json = (await res.json()) as { success: boolean; error?: string; message?: string };
        if (!res.ok || !json?.success) {
          setFoundingMsg(json?.error ?? 'Could not save. Please try again.');
        } else {
          setFoundingMsg(json?.message ?? "Welcome! 🎉 We'll confirm your spot by WhatsApp.");
          setFormName(''); setFormPhone('');
          setFounding(prev => ({ count: (prev?.count ?? 0) + 1 }));
        }
      } catch {
        setFoundingMsg('Network error. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [formName, formPhone]
  );

  /* ══════════════════════════ RENDER ══════════════════════════ */
  return (
    <>
      {/* Decorative cursor (pointer devices only) */}
      <motion.div
        className="aw-cursor"
        style={{ x: springX, y: springY }}
        aria-hidden="true"
      />

      {/* ── GLOBAL CSS ── */}
      <style>{`
        /* Fonts load from root layout <link> — avoid duplicate @import */

        :root {
          --navy:  #020c18;
          --navy2: #041424;
          --blue:  #0ea5e9;
          --cyan:  #22d3ee;
          --green: #10b981;
          --violet: #6366f1;
          --font-display: 'Bricolage Grotesque', 'Syne', system-ui, sans-serif;
          --font-body:    'DM Sans', system-ui, sans-serif;
          --font-mono:    'Syne', system-ui, sans-serif;
          --fd: var(--font-display);
          --fh: var(--font-display);
          --fb: var(--font-body);
          --glass: rgba(7,30,52,0.65);
          --glass-b: rgba(14,165,233,0.16);
        }

        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: var(--font-body); background: var(--navy); overflow-x: hidden; }
        .font-display { font-family: var(--font-display); }

        /* ═══ Hero typography (no clipping, 360px–desktop) ═══ */
        .hero-section {
          overflow: visible;
          position: relative;
        }

        .hero-headline {
          font-family:    var(--font-display);
          font-weight:    800;
          font-style:     normal;
          font-optical-sizing: auto;
          font-size:      clamp(2.2rem, 5.5vw, 4.8rem);
          line-height:    1.06;
          letter-spacing: -0.5px;
          color: #ffffff;
          padding-block: 0.04em;
          overflow: visible;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        @media (max-width: 480px) {
          .hero-headline {
            letter-spacing: 0;
            font-size: clamp(2rem, 8vw, 3rem);
            line-height: 1.08;
          }
        }

        .hero-headline-accent { color: #60A5FA; }

        .hero-headline-hindi {
          font-family: 'Noto Sans Devanagari', system-ui, sans-serif;
          font-weight: 700;
          font-size: clamp(2rem, 8vw, 3rem);
          line-height: 1.35;
          letter-spacing: 0;
          color: #ffffff;
          padding-top: 0.1em;
          padding-bottom: 0.04em;
          overflow: visible;
          -webkit-font-smoothing: antialiased;
        }
        @media (min-width: 481px) {
          .hero-headline-hindi {
            font-size: clamp(2.2rem, 5.5vw, 4.25rem);
            line-height: 1.35;
          }
        }

        .hero-sub {
          font-family:   var(--font-body);
          font-weight:   400;
          font-size:     clamp(0.95rem, 1.8vw, 1.15rem);
          line-height:   1.65;
          color:         rgba(255, 255, 255, 0.60);
          letter-spacing: 0;
          max-width:     520px;
          overflow:      visible;
        }
        @media (max-width: 480px) {
          .hero-sub { font-size: 0.95rem; line-height: 1.6; }
        }

        .hero-eyebrow {
          display:        inline-flex;
          align-items:    center;
          gap:            7px;
          padding:        5px 14px;
          border-radius:  99px;
          background:     rgba(96, 165, 250, 0.12);
          border:         1px solid rgba(96, 165, 250, 0.28);
          font-family:    var(--font-body);
          font-size:      11px;
          font-weight:    700;
          color:          #93C5FD;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom:  18px;
          overflow:       visible;
        }

        .hero-stat-val {
          font-family:    var(--font-display);
          font-weight:    900;
          font-size:      clamp(2rem, 4.5vw, 3rem);
          letter-spacing: -1px;
          line-height:    1;
          color:          #ffffff;
          text-shadow:    0 0 36px rgba(96, 165, 250, 0.45), 0 2px 12px rgba(0, 0, 0, 0.35);
          -webkit-font-smoothing: antialiased;
          padding-bottom: 0.06em;
          overflow:       visible;
        }

        .hero-stat-lbl {
          font-family:   var(--font-body);
          font-size:     11px;
          font-weight:   700;
          color:         rgba(255, 255, 255, 0.72);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top:    6px;
        }

        .hero-gradient-text {
          background-image: linear-gradient(135deg, #60A5FA 0%, #34D399 100%);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          display: inline-block;
          padding-bottom: 0.08em;
          line-height: 1.1;
        }

        .section-heading {
          font-family:    var(--font-display);
          font-weight:    700;
          font-size:      clamp(1.5rem, 3.5vw, 2.4rem);
          line-height:    1.1;
          letter-spacing: -0.3px;
          color:          #0A1628;
          overflow:       visible;
          padding-block:  0.02em;
          -webkit-font-smoothing: antialiased;
        }
        @media (max-width: 480px) {
          .section-heading {
            font-size: clamp(1.4rem, 6.5vw, 1.8rem);
            letter-spacing: -0.1px;
          }
        }
        .section-heading-light { color: #ffffff; }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: var(--navy); }
        ::-webkit-scrollbar-thumb { background: var(--blue); border-radius: 3px; }

        /* ─ Cursor ─ */
        .aw-cursor {
          position: fixed; top: 0; left: 0;
          width: 24px; height: 24px; border-radius: 50%;
          border: 1.5px solid rgba(14,165,233,0.6);
          pointer-events: none; z-index: 9999; mix-blend-mode: screen;
        }
        @media (pointer:coarse) { .aw-cursor { display:none; } }

        /* ─ Keyframes ─ */
        @keyframes aw-shimmer { 0%{background-position:-300% center} 100%{background-position:300% center} }
        @keyframes aw-grad    { 0%,100%{background-position:0% 50%}  50%{background-position:100% 50%} }
        @keyframes aw-float   { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-16px) scale(1.04)} }
        @keyframes aw-ripple  { 0%{transform:scale(0.75);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
        @keyframes aw-prog    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes aw-mql     { from{transform:translateX(0)}    to{transform:translateX(-50%)} }
        @keyframes aw-mqr     { from{transform:translateX(-50%)} to{transform:translateX(0)} }
        @keyframes aw-dot-p   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.75)} }

        /* ─ Shimmer headline ─ */
        .aw-shimmer {
          background: linear-gradient(90deg,#7dd3fc 0%,#ffffff 30%,#22d3ee 55%,#7dd3fc 100%);
          background-size: 300% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; animation: aw-shimmer 4s linear infinite;
        }

        /* ─ Primary button ─ */
        .aw-btn {
          background: linear-gradient(135deg,#0284c7 0%,#0ea5e9 40%,#22d3ee 100%);
          background-size: 200% 200%; animation: aw-grad 3s ease infinite;
          color:#fff; font-family:var(--fd); font-weight:700;
          border-radius:999px; border:none; cursor:pointer;
          position:relative; overflow:hidden;
          transition:transform .18s ease, box-shadow .18s ease, filter .18s ease;
          will-change:transform; display:inline-flex; align-items:center; gap:8px;
          text-decoration:none;
          box-shadow: 0 10px 30px rgba(14,165,233,.32), inset 0 1px 0 rgba(255,255,255,.3);
        }
        .aw-btn::after {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 60%);
          pointer-events:none;
        }
        .aw-btn:hover { transform:translateY(-2px); box-shadow:0 16px 36px rgba(14,165,233,.5); filter:saturate(1.08); }
        .aw-btn:active { transform:translateY(0); }
        .aw-btn:disabled { opacity:.58; cursor:not-allowed; animation:none; }

        /* ─ Outline button ─ */
        .aw-btn-ol {
          display:inline-flex; align-items:center; gap:8px; text-decoration:none;
          border:1.5px solid rgba(14,165,233,.38); color:#bae6fd;
          font-family:var(--fd); font-weight:600; border-radius:999px;
          background:rgba(14,165,233,.07); backdrop-filter:blur(8px);
          transition:background .18s,border-color .18s,transform .18s;
        }
        .aw-btn-ol:hover { background:rgba(14,165,233,.16); border-color:rgba(14,165,233,.65); transform:translateY(-1px); box-shadow:0 8px 24px rgba(14,165,233,.2); }

        /* ─ Glass ─ */
        .aw-glass { background:var(--glass); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border:1px solid var(--glass-b); border-radius:20px; }
        .aw-glass-light { background:rgba(255,255,255,.93); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid rgba(14,165,233,.18); }

        /* ─ Card hover ─ */
        .aw-card { transition:transform .26s cubic-bezier(.34,1.56,.64,1),box-shadow .26s ease; will-change:transform; }
        .aw-card:hover { transform:translateY(-7px); box-shadow:0 24px 56px rgba(14,165,233,.12); }

        /* ─ Badge ─ */
        .aw-badge {
          display:inline-block; font-family:var(--fd); font-size:.63rem;
          font-weight:700; letter-spacing:.18em; text-transform:uppercase;
          color:#38bdf8; background:rgba(14,165,233,.1); border:1px solid rgba(14,165,233,.28);
          border-radius:999px; padding:4px 14px; margin-bottom:14px;
        }
        .aw-badge-dk { color:#0369a1; background:rgba(14,165,233,.08); border-color:rgba(14,165,233,.22); }

        /* ─ Svc tab ─ */
        .aw-tab { border:1.5px solid rgba(14,165,233,.22); color:#93c5fd; border-radius:999px; font-family:var(--fd); font-weight:600; font-size:.8rem; padding:8px 20px; cursor:pointer; transition:all .2s; background:transparent; white-space:nowrap; }
        .aw-tab:hover { background:rgba(14,165,233,.1); }
        .aw-tab.active { background:linear-gradient(135deg,#0284c7,#0ea5e9); border-color:transparent; color:#fff; box-shadow:0 4px 18px rgba(14,165,233,.4); }

        /* ─ Dot ─ */
        .aw-dot { width:8px; height:8px; border-radius:999px; background:rgba(14,165,233,.3); cursor:pointer; border:none; transition:all .25s; padding:0; }
        .aw-dot.active { width:24px; background:#0ea5e9; }

        /* ─ Input ─ */
        .aw-input { background:#fff; border:1.5px solid #e2e8f0; border-radius:14px; padding:12px 16px; font-size:.875rem; color:#0f172a; width:100%; outline:none; font-family:var(--fb); transition:border-color .2s,box-shadow .2s; }
        .aw-input::placeholder { color:#94a3b8; }
        .aw-input:focus { border-color:#0ea5e9; box-shadow:0 0 0 3px rgba(14,165,233,.15); }

        /* ─ Hero bg ─ */
        .aw-hero-bg {
          background:
            radial-gradient(ellipse 85% 65% at 18% 18%,rgba(14,165,233,.22) 0%,transparent 68%),
            radial-gradient(ellipse 65% 55% at 82% 72%,rgba(6,182,212,.17) 0%,transparent 68%),
            radial-gradient(ellipse 45% 40% at 50% 108%,rgba(16,185,129,.11) 0%,transparent 70%),
            linear-gradient(165deg,#020c18 0%,#041424 55%,#020c18 100%);
        }
        .aw-hero-bg::before{
          content:'';
          position:absolute; inset:0;
          background:
            linear-gradient(105deg, rgba(99,102,241,.12), transparent 30%),
            linear-gradient(255deg, rgba(14,165,233,.14), transparent 35%);
          pointer-events:none;
        }

        /* ─ Progress bar ─ */
        .aw-prog {
          background:linear-gradient(90deg,#0284c7,#22d3ee,#10b981,#22d3ee,#0284c7);
          background-size:300% 100%; animation:aw-prog 2.5s linear infinite;
        }

        /* ─ Misc ─ */
        .aw-float   { animation:aw-float 3.8s ease-in-out infinite; }
        .aw-ring    { animation:aw-ripple 2.4s ease-out infinite; }
        .aw-ring:nth-child(2) { animation-delay:.8s; }
        .aw-ring:nth-child(3) { animation-delay:1.6s; }
        .aw-glow    { text-shadow:0 0 28px rgba(14,165,233,.55); }
        .aw-live    { width:8px;height:8px;border-radius:50%;background:#4ade80;animation:aw-dot-p 2s ease-in-out infinite; }

        .aw-grid-dots  { background-image:radial-gradient(circle,#38bdf8 1px,transparent 1px); background-size:48px 48px; }
        .aw-grid-lines { background-image:linear-gradient(rgba(14,165,233,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.8) 1px,transparent 1px); background-size:60px 60px; }

        .aw-mql { animation:aw-mql 42s linear infinite; }
        .aw-mqr { animation:aw-mqr 48s linear infinite; }
        .aw-mql:hover,.aw-mqr:hover { animation-play-state:paused; }
        @media(max-width:640px){ .aw-mql{animation-duration:26s;} .aw-mqr{animation-duration:30s;} }

        .aw-review-card { transition:transform .2s; }
        .aw-review-card:hover { transform:scale(1.02); }

        .aw-hero-copy { max-width: 38rem; }
      `}</style>

      <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--navy)' }}>

        {/* ═══════════════════════════════ HERO ═══════════════════════════════ */}
        <section ref={heroRef} className="aw-hero-bg hero-section relative min-h-screen flex flex-col overflow-x-hidden overflow-y-visible">

          {/* Grid texture */}
          <div className="absolute inset-0 pointer-events-none aw-grid-dots" style={{ opacity: .028 }} aria-hidden="true" />

          {/* Ambient orbs */}
          <HeroGlowOrbs />

          {/* Rising drops */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            {DROPS_CONFIG.map((d, i) => <RisingDrop key={i} {...d} />)}
          </div>

          {/* Ripple ring — top right */}
          <div className="absolute top-16 right-8 sm:right-16 w-52 h-52 pointer-events-none hidden sm:flex items-center justify-center" aria-hidden="true">
            {[1,2,3].map(i => (
              <div key={i} className="aw-ring absolute rounded-full border-2 border-sky-400/20"
                style={{ width: i*60, height: i*60 }} />
            ))}
            <span className="aw-float relative z-10 text-5xl select-none">💧</span>
          </div>

          {/* Ripple ring — bottom left */}
          <div className="absolute bottom-28 left-8 sm:left-16 w-32 h-32 pointer-events-none hidden md:flex items-center justify-center opacity-55" aria-hidden="true">
            {[1,2].map(i => (
              <div key={i} className="aw-ring absolute rounded-full border border-teal-400/18"
                style={{ width: i*48, height: i*48, animationDelay: `${i*.7}s` }} />
            ))}
            <span className="aw-float relative z-10 text-3xl select-none" style={{ animationDelay: '1s' }}>🔧</span>
          </div>

          {/* ── Content ── */}
          <motion.div className="relative z-10 flex-1 flex items-center" style={{ y: heroY, opacity: heroOpacity }}>
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20 sm:py-24 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-[1.15fr,1fr] gap-12 xl:gap-16 items-center">

                {/* ── LEFT ── */}
                <motion.div
                  className="aw-hero-copy text-safe"
                  style={{ overflow: 'visible' }}
                  initial={{ opacity: 0, x: -36 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: .75, ease: [.22,1,.36,1] }}
                >
                  {/* Eyebrow — DM Sans, no clip */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="hero-eyebrow"
                  >
                    <span className="aw-live shrink-0" aria-hidden="true" />
                    Now live in Delhi &amp; UP
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16 }}
                    className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400/70 mb-4"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    AuroWater · ऑन-डिमांड पानी + प्लम्बर
                  </motion.p>

                  <h1 className="mb-6 overflow-visible text-safe" style={{ overflow: 'visible' }}>
                    <span className="hero-headline-hindi block">
                      शुद्ध पानी।{' '}
                      <span className="hero-headline-accent">सीधे आपके दरवाज़े तक।</span>
                    </span>
                    <span className="hero-headline block text-white mt-2">Pure Water,</span>
                    <span className="hero-headline block mt-1">
                      <span className="hero-headline-accent aw-glow">At Your Door.</span>
                    </span>
                  </h1>

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="hero-sub mb-9 max-w-lg"
                  >
                    Book RO service, water cans, plumbing &amp; more — verified pros, upfront prices, same-day slots.
                    On-demand delivery for students, families, offices &amp; events in one simple app.
                  </motion.p>

                  {/* CTAs */}
                  <motion.div className="flex flex-wrap gap-3 mb-9"
                    initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:.3 }}>
                    <Link href="/book?service=water_tanker" className="aw-btn px-7 py-3.5 text-sm sm:text-base shadow-xl">
                      💧 Order Water Now
                    </Link>
                    <Link href="/book?service=plumbing" className="aw-btn-ol px-7 py-3.5 text-sm sm:text-base">
                      🔧 Book a Plumber
                    </Link>
                  </motion.div>

                  {/* Trust pills */}
                  <motion.div className="flex flex-wrap gap-2"
                    initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.42 }}>
                    {['Cash + UPI','Hindi & English','2hr Emergency','Free Delivery'].map(tag => (
                      <span key={tag} className="rounded-full border border-sky-500/20 bg-sky-500/8 text-sky-300/80 text-xs font-medium px-3 py-1">
                        ✦ {tag}
                      </span>
                    ))}
                  </motion.div>

                  <motion.div
                    className="mt-4 text-sm text-white/70 font-semibold"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.46 }}
                  >
                    <div className="flex flex-wrap gap-x-5 gap-y-1">
                      <div>
                        <span className="text-white font-extrabold">
                          {Math.max(2000, deliveredCount).toLocaleString('en-IN')}+
                        </span>{' '}
                        cans delivered in Delhi & UP
                      </div>
                      <div>
                        <span className="text-white font-extrabold">
                          {Math.max(500 , customersCount).toLocaleString('en-IN')}+
                        </span>{' '}
                        happy customers
                      </div>
                      <div>
                        <span className="text-white font-extrabold">
                          {Math.max(100, suppliersCount).toLocaleString('en-IN')}
                        </span>{' '}
                        active suppliers
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* ── RIGHT ── */}
                <motion.div className="flex flex-col gap-4"
                  initial={{ opacity:0, x:36 }} animate={{ opacity:1, x:0 }}
                  transition={{ delay:.18, duration:.75, ease:[.22,1,.36,1] }}>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    {STATS.map((s, i) => (
                      <motion.div key={s.label} className="rounded-2xl border border-white/15 bg-white/[0.09] px-5 py-4 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                        initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                        transition={{ delay:.32+i*.07 }}>
                        <div className="text-2xl mb-2 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]">{s.icon}</div>
                        <div
                          className="hero-stat-val"
                          style={{ textShadow: `0 0 22px ${s.glow}60` }}
                        >
                          <CountUp target={parseFloat(s.value)} suffix={s.suffix} isDecimal={s.value.includes('.')} />
                        </div>
                        <div className="hero-stat-lbl">{s.label}</div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Why card */}
                  <motion.div className="aw-glass p-5"
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ delay:.54 }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-display text-xs font-bold text-emerald-300 uppercase tracking-widest">Why AuroWater</span>
                    </div>
                    <ul className="space-y-2.5">
                      {[
                        'Water cans at ₹10–15 with real-time availability',
                        'Verified suppliers & background-checked plumbers',
                        'Emergency delivery in under 2 hours (select areas)',
                        'Hindi + English support · Cash + UPI payments',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-sky-100/72">
                          <span className="text-sky-400 mt-0.5 flex-shrink-0 text-xs">◆</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </motion.div>

                  {/* Audience tags */}
                  <motion.div className="flex flex-wrap gap-2"
                    initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.64 }}>
                    {['👨‍🎓 Students & PG','🏠 Families','🏢 Offices','🎪 Events'].map(tag => (
                      <span key={tag} className="rounded-full border border-sky-400/24 bg-sky-400/7 px-3 py-1 text-xs font-medium text-sky-200">
                        {tag}
                      </span>
                    ))}
                  </motion.div>
                </motion.div>

              </div>
            </div>
          </motion.div>

          {/* Wave */}
          <div className="relative z-10"><WaveDivider color="#f8fafc" /></div>
        </section>

        {/* ═══════ TRUST STRIP ═══════ */}
        <section className="bg-slate-50 py-4 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex flex-wrap justify-center gap-x-7 gap-y-2 text-xs sm:text-sm text-slate-500 font-semibold">
              {TRUST_BADGES.map(b => <span key={b}>{b}</span>)}
            </div>
          </div>
        </section>

        {/* ═══════ THREE PATHS ═══════ */}
        <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-12"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge aw-badge-dk">Choose Your Role</span>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
                Three paths —<br className="hidden sm:block" /> pick the one that fits you
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {ROLES.map((role, i) => (
                <motion.div key={role.title}
                  className="aw-card bg-white rounded-3xl p-7 border border-slate-100 shadow-sm flex flex-col"
                  initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay:i*.1 }}>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center text-2xl mb-5 shadow-lg`}
                    style={{ boxShadow:`0 6px 20px ${role.shadow}` }}>
                    {role.icon}
                  </div>
                  <h3 className="font-display text-lg font-extrabold text-slate-900 mb-2">{role.title}</h3>
                  <p className="text-sm text-slate-500 mb-5 leading-relaxed flex-1">{role.desc}</p>
                  <ul className="space-y-2 mb-7">
                    {role.perks.map(p => (
                      <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-emerald-500 font-bold">✓</span> {p}
                      </li>
                    ))}
                  </ul>
                  <Link href={role.href}
                    className={`inline-flex items-center justify-center w-full rounded-2xl bg-gradient-to-r ${role.gradient} text-white px-6 py-3.5 text-sm font-bold font-display shadow hover:opacity-90 transition`}>
                    {role.cta}
                  </Link>
                </motion.div>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-slate-500">
              🛡️ All accounts are phone-verified. Suppliers &amp; plumbers undergo KYC before activation.
            </p>
          </div>
        </section>

        {/* ═══════ SERVICES (dark) ═══════ */}
        <div className="bg-slate-50"><WaveDivider flip color="var(--navy)" /></div>
        <section className="py-16 sm:py-20 lg:py-24 relative overflow-hidden" style={{ background:'var(--navy)' }} id="services">
          <div className="absolute inset-0 pointer-events-none aw-grid-dots" style={{ opacity:.035 }} aria-hidden="true" />

          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-12"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge">What We Offer</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">Services for every water need</h2>
            </motion.div>

            <div className="flex justify-center gap-2 flex-wrap mb-10">
              {SERVICES.map((s, i) => (
                <button key={s.title} type="button" onClick={() => setActiveSvc(i)}
                  className={`aw-tab ${activeSvc===i ? 'active' : ''}`}>
                  {s.icon} {s.title}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={activeSvc}
                initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-16 }} transition={{ duration:.3 }}
                className="aw-glass max-w-3xl mx-auto p-8 sm:p-10">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                    style={{ background:SERVICES[activeSvc].accentBg, border:`1.5px solid ${SERVICES[activeSvc].accent}44` }}>
                    {SERVICES[activeSvc].icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <h3 className="font-display text-xl font-extrabold text-white">{SERVICES[activeSvc].title}</h3>
                      <span className="rounded-full text-xs font-bold px-3 py-0.5 border"
                        style={{ background:SERVICES[activeSvc].accentBg, borderColor:`${SERVICES[activeSvc].accent}44`, color:SERVICES[activeSvc].accent }}>
                        {SERVICES[activeSvc].badge}
                      </span>
                    </div>
                    <p className="text-sky-100/65 mb-5">{SERVICES[activeSvc].body}</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {SERVICES[activeSvc].features.map(f => (
                        <span key={f} className="flex items-center gap-1.5 text-xs font-semibold rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 px-3 py-1">
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                    <Link href={SERVICES[activeSvc].href} className="aw-btn px-7 py-3 text-sm shadow-lg">
                      {SERVICES[activeSvc].cta} →
                    </Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-2 mt-6">
              {SERVICES.map((_, i) => (
                <button key={i} type="button" onClick={() => setActiveSvc(i)}
                  className={`aw-dot ${i===activeSvc ? 'active' : ''}`}
                  aria-label={`Service ${i+1}`} />
              ))}
            </div>
          </div>
          <div className="mt-16"><WaveDivider color="#f8fafc" /></div>
        </section>

        {/* ═══════ WHY AUROWATER ═══════ */}
        <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-12"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge aw-badge-dk">Our Promise</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Why AuroWater</h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {WHY_CARDS.map((f, i) => (
                <motion.div key={f.title}
                  className="aw-card bg-white rounded-3xl p-6 border border-slate-100 shadow-sm"
                  initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay:i*.09 }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-4"
                    style={{ background:`${f.accent}14`, color:f.accent }}>
                    {f.icon}
                  </div>
                  <h3 className="font-display font-extrabold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ WHO WE SERVE ═══════ */}
        <section className="bg-white py-14 sm:py-16">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"
              initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              Who we serve
            </motion.h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SERVE_ITEMS.map((item, i) => (
                <motion.div key={item.label}
                  className="aw-card flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4 text-center"
                  initial={{ opacity:0, scale:.88 }} whileInView={{ opacity:1, scale:1 }}
                  viewport={{ once:true }} transition={{ delay:i*.05 }}>
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-700">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ REVIEWS MARQUEE ═══════ */}
        <section className="bg-slate-50 py-14 overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-10">
            <motion.div className="text-center"
              initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge aw-badge-dk">Social Proof</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Trusted by customers</h2>
              <p className="text-slate-500 mt-2 text-sm">Real experiences from people across UP &amp; Delhi.</p>
            </motion.div>
          </div>
          <div className="space-y-4">
            <div className="overflow-hidden">
              <div className="flex gap-4 aw-mql">
                {reviewsLeft.map((r, idx) => <ReviewCard key={`L${idx}`} r={r} />)}
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="flex gap-4 aw-mqr">
                {reviewsRight.map((r, idx) => <ReviewCard key={`R${idx}`} r={r} />)}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════ HOW IT WORKS (dark) ═══════ */}
        <div className="bg-slate-50"><WaveDivider flip color="var(--navy)" /></div>
        <section className="py-16 sm:py-20 lg:py-24 relative overflow-hidden" style={{ background:'var(--navy)' }} id="how-it-works">
          <div className="absolute inset-0 pointer-events-none aw-grid-lines" style={{ opacity:.032 }} aria-hidden="true" />

          <div className="relative max-w-5xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-12"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge">Simple Process</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">How it works</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-11 left-[35%] right-[35%] h-px"
                style={{ background:'linear-gradient(90deg,transparent,rgba(14,165,233,.5),transparent)' }}
                aria-hidden="true" />

              {STEPS.map((item, i) => (
                <motion.div key={item.n}
                  className="aw-glass flex flex-col items-center text-center p-7"
                  initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay:i*.12 }}>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center text-2xl mb-4 z-10"
                    style={{ boxShadow:'0 6px 24px rgba(14,165,233,.42)' }}>
                    {item.icon}
                  </div>
                  <div className="font-display text-xs font-extrabold text-sky-400 tracking-widest mb-2">{item.n}</div>
                  <h3 className="font-display text-base font-extrabold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-300/75 leading-relaxed">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="mt-16"><WaveDivider color="#f8fafc" /></div>
        </section>

        {/* ═══════ FOUNDING MEMBERS ═══════ */}
        <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
            <div className="grid lg:grid-cols-[1.35fr,1fr] gap-10 items-center">

              <motion.div initial={{ opacity:0, x:-28 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }}>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 mb-5">
                  <span>🔥</span>
                  <span className="font-display text-xs font-bold text-amber-700 uppercase tracking-wide">Limited Spots</span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
                  Join Our First<br />
                  <span className="text-sky-600">100 Founding Members</span>
                </h2>
                <p className="text-slate-600 mb-5 leading-relaxed">
                  पहले 100 customers में शामिल हों और हमेशा के लिए बेहतर पानी और प्रायोरिटी सर्विस पाएं।
                </p>
                <ul className="space-y-2.5 mb-7">
                  {FOUNDING_PERKS.map(item => (
                    <li key={item.t} className="flex items-center gap-3 text-sm text-slate-700">
                      <span>{item.icon}</span> {item.t}
                    </li>
                  ))}
                </ul>
                <div className="mb-2 flex justify-between text-sm font-semibold">
                  <span className="text-slate-700">{claimed} of 100 spots claimed</span>
                  <span className="text-sky-600">{100 - claimed} remaining</span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
                  <div className="h-full rounded-full aw-prog transition-[width] duration-700" style={{ width:`${progress}%` }} />
                </div>
                <p className="text-xs text-slate-400">We&apos;ll confirm your spot by SMS/WhatsApp within 24 hours.</p>
              </motion.div>

              <motion.div className="aw-glass-light rounded-3xl p-7 sm:p-8 shadow-xl"
                initial={{ opacity:0, x:28 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }}>
                <h3 className="font-display text-xl font-extrabold text-slate-900 mb-5">Reserve your spot</h3>
                <form onSubmit={handleFoundingSubmit} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="f-name" className="block font-display text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Full Name</label>
                    <input id="f-name" type="text" value={formName} onChange={e => setFormName(e.target.value)}
                      className="aw-input" placeholder="e.g. Arjun Singh" autoComplete="name" required />
                  </div>
                  <div>
                    <label htmlFor="f-phone" className="block font-display text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Phone (WhatsApp)</label>
                    <input id="f-phone" type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                      className="aw-input" placeholder="10-digit Indian mobile" autoComplete="tel" inputMode="tel" required />
                  </div>
                  <button type="submit" disabled={submitting}
                    className="aw-btn w-full justify-center py-3.5 text-sm" style={{ borderRadius:14 }}>
                    {submitting ? '⏳ Saving…' : 'Join the first 100 →'}
                  </button>
                  <AnimatePresence>
                    {foundingMsg && (
                      <motion.p key="msg"
                        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                        className={`text-sm text-center font-medium ${
                          foundingMsg.includes('Welcome') || foundingMsg.includes('🎉')
                            ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                        {foundingMsg}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </form>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════ EARN (dark) ═══════ */}
        <div className="bg-slate-50"><WaveDivider flip color="var(--navy)" /></div>
        <section className="py-16 sm:py-20 relative" style={{ background:'var(--navy)' }}>
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-10"
              initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge">Partner With Us</span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Earn with AuroWater</h2>
            </motion.div>
            <div className="grid md:grid-cols-2 gap-5">
              {EARN_CARDS.map((c, i) => (
                <motion.div key={c.title}
                  className="rounded-3xl p-7 sm:p-8"
                  style={{ border:`1.5px solid ${c.borderColor}`, background:c.bgColor, backdropFilter:'blur(12px)' }}
                  initial={{ opacity:0, y:22 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay:i*.1 }}>
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <h3 className="font-display text-lg font-extrabold text-white mb-1">{c.title}</h3>
                  <div className="font-display text-2xl font-extrabold mb-3" style={{ color:c.earnColor }}>{c.earn}</div>
                  <p className="text-sm text-slate-300/72 mb-5 leading-relaxed">{c.desc}</p>
                  <Link href={c.href}
                    className={`inline-flex items-center justify-center rounded-full bg-gradient-to-r ${c.btnClass} text-white px-6 py-3 text-sm font-bold font-display shadow hover:opacity-90 transition`}>
                    {c.cta}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ FINAL CTA ═══════ (gradient meets global Footer wave #08111F) */}
        <section
          className="relative overflow-hidden pt-16 pb-6 sm:pt-20 sm:pb-8"
          style={{
            background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy) 45%, #08111F 100%)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background:'radial-gradient(ellipse 80% 60% at 50% 50%,rgba(14,165,233,.11) 0%,transparent 70%)' }}
            aria-hidden="true" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
            {[1,2,3].map(i => (
              <div key={i} className="aw-ring absolute rounded-full border border-sky-400/10"
                style={{ width:i*200, height:i*200, animationDelay:`${i*.7}s` }} />
            ))}
          </div>

          <div className="relative max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge">Get Started Today</span>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-5">
                Water shouldn&apos;t be a<br className="hidden sm:block" /> daily headache.
              </h2>
              <p className="text-base sm:text-lg text-slate-300/72 mb-8 max-w-2xl mx-auto leading-relaxed">
                AuroWater keeps your cans filled, pumps running, and events flowing — so you can focus on life, not logistics.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/book" className="aw-btn px-8 py-4 text-base shadow-2xl">💧 Start in 30 seconds →</Link>
                <Link href="/pricing" className="aw-btn-ol px-8 py-4 text-base">View transparent pricing</Link>
              </div>
            </motion.div>
          </div>
        </section>

      </div>
    </>
  );
}