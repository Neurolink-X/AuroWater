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





'use client';

import Link from 'next/link';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { TRUST_REVIEWS } from '@/lib/trust-reviews';

interface FoundingStats {
  count: number;
}

/* ─── Animated water drop SVG background ─── */
const WaterDropsBg = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="drop1" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="drop2" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.14" />
        <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
      </radialGradient>
      <filter id="blur-soft">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
    {/* Large ambient orbs */}
    <ellipse cx="10%" cy="30%" rx="340" ry="280" fill="url(#drop1)" filter="url(#blur-soft)" />
    <ellipse cx="90%" cy="60%" rx="400" ry="320" fill="url(#drop2)" filter="url(#blur-soft)" />
    <ellipse cx="50%" cy="100%" rx="600" ry="200" fill="url(#drop1)" filter="url(#blur-soft)" />
  </svg>
);

/* ─── Animated water wave divider ─── */
const WaveDivider = ({ flip = false, color = '#f8fafc' }: { flip?: boolean; color?: string }) => (
  <div
    className="w-full overflow-hidden leading-none"
    style={{ transform: flip ? 'rotate(180deg)' : undefined, marginBottom: '-2px' }}
  >
    <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-12 sm:h-16">
      <path
        d="M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1380,20 1440,40 L1440,80 L0,80 Z"
        fill={color}
      />
    </svg>
  </div>
);

/* ─── Floating water drop particle ─── */
const FloatingDrop = ({ x, delay, size, opacity }: { x: string; delay: number; size: number; opacity: number }) => (
  <motion.div
    className="absolute bottom-0 pointer-events-none"
    style={{ left: x, opacity }}
    animate={{ y: [0, -120, -240], opacity: [0, opacity, 0], scale: [0.5, 1, 0.3] }}
    transition={{ duration: 4 + delay, delay, repeat: Infinity, ease: 'easeOut' }}
  >
    <svg width={size} height={size * 1.3} viewBox="0 0 20 26" fill="none">
      <path d="M10 2 C10 2 2 12 2 17 a8 8 0 0 0 16 0 C18 12 10 2 10 2 Z" fill="#38bdf8" fillOpacity="0.7" />
    </svg>
  </motion.div>
);

/* ─── Stat counter animation ─── */
const AnimatedStat = ({ value, suffix = '' }: { value: string; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const numericMatch = value.match(/\d+/);
  const numeric = numericMatch ? parseInt(numericMatch[0]) : 0;
  const prefix = value.replace(/[\d+]+/, '');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView || !numeric) return;
    let start = 0;
    const end = numeric;
    const duration = 1600;
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, numeric]);

  return (
    <span ref={ref}>
      {prefix}{isInView && numeric ? count : 0}{value.includes('+') ? '+' : ''}{suffix}
    </span>
  );
};

/* ─── Review card ─── */
const ReviewCard = ({ r }: { r: typeof TRUST_REVIEWS[number] }) => (
  <div className="min-w-[300px] max-w-[340px] rounded-2xl border border-sky-100 bg-white shadow-md px-5 py-5 flex-shrink-0">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${r.color} text-white flex items-center justify-center font-bold text-sm shadow`}>
        {r.initials}
      </div>
      <div>
        <div className="font-bold text-slate-900 text-sm leading-tight">{r.name}</div>
        <div className="text-xs text-slate-500 mt-0.5">{r.city} · {r.date}</div>
      </div>
      <div className="ml-auto flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < r.rating ? 'text-amber-400' : 'text-slate-200'} style={{ fontSize: '11px' }}>★</span>
        ))}
      </div>
    </div>
    <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 mb-2">{r.service}</span>
    <p className="text-sm text-slate-600 leading-relaxed italic">"{r.text}"</p>
  </div>
);

export default function HomePage() {
  const [founding, setFounding] = useState<FoundingStats | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [foundingMsg, setFoundingMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeService, setActiveService] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/founding-members', { cache: 'no-store' });
        const json = await res.json();
        if (json?.success) setFounding(json.data);
      } catch { /* silent */ }
    })();
  }, []);

  const claimed = Math.min(founding?.count ?? 73, 100);
  const progress = (claimed / 100) * 100;

  const handleFoundingSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFoundingMsg(null);
    if (!name.trim() || !phone.trim()) { setFoundingMsg('Please enter your name and phone.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/founding-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setFoundingMsg(json?.error || 'Could not save. Please try again.');
      } else {
        setFoundingMsg(json?.message || 'Welcome to the founding members! 🎉');
        setName(''); setPhone('');
        setFounding(prev => ({ count: (prev?.count ?? 0) + 1 }));
      }
    } catch { setFoundingMsg('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  }, [name, phone]);

  const services = [
    {
      icon: '💧', title: 'Water Delivery',
      body: 'Daily cans ₹10–15 · Free doorstep delivery · Perfect for hostels, families & offices.',
      cta: 'Order Now', href: '/book?service=water_tanker',
      badge: 'Most Popular',
      features: ['Real-time tracking', 'Free delivery', 'Cash + UPI'],
    },
    {
      icon: '🔧', title: 'Plumber Service',
      body: 'Fitting, boring, repair & pump installation by verified local plumbers.',
      cta: 'Book Now', href: '/book?service=plumbing',
      badge: 'Verified Pros',
      features: ['Background checked', 'Fixed pricing', 'Same-day service'],
    },
    {
      icon: '🚚', title: 'Bulk & Events',
      body: 'Weddings, offices, construction, schools — cans, tankers & plumber teams on demand.',
      cta: 'Get Quote', href: '/contact',
      badge: 'Enterprise',
      features: ['Custom volume', 'Dedicated team', 'Priority support'],
    },
  ];

  const stats = [
    { value: '500+', label: 'Daily Deliveries', icon: '💧' },
    { value: '50+', label: 'Expert Plumbers', icon: '🔧' },
    { value: '20+', label: 'Suppliers', icon: '🚛' },
    { value: '4.8', label: 'Star Rating', icon: '⭐' },
  ];

  const roles = [
    {
      icon: '💧', title: 'I Need Water & Plumber',
      desc: 'Order water, book plumbers, track deliveries. Sign up in 30 seconds.',
      perks: ['Instant signup', 'No documents needed', 'Start ordering immediately'],
      cta: 'Sign Up Free →', href: '/auth/register',
      gradient: 'from-sky-500 to-cyan-400', color: 'sky',
    },
    {
      icon: '🚛', title: 'I Supply Water',
      desc: 'Partner with us to deliver water. Get verified and receive orders.',
      perks: ['KYC verification', 'Admin approval', 'Start earning once approved'],
      cta: 'Apply as Supplier →', href: '/auth/register?role=supplier',
      gradient: 'from-emerald-500 to-teal-400', color: 'emerald',
    },
    {
      icon: '🔧', title: "I'm a Plumber / Tech",
      desc: 'Get verified, showcase your skills, and receive job requests.',
      perks: ['Skill verification', 'Background check', 'Earn on your schedule'],
      cta: 'Apply as Plumber →', href: '/auth/register?role=technician',
      gradient: 'from-violet-500 to-purple-400', color: 'violet',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif" }}>

      {/* ═══════════════════════════════════════════════════
          GOOGLE FONTS INJECT (Plus Jakarta Sans + DM Sans)
      ═══════════════════════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        /* ─── CSS Variables ─── */
        :root {
          --water-blue: #0ea5e9;
          --water-deep: #0369a1;
          --water-cyan: #22d3ee;
          --water-teal: #14b8a6;
          --emerald: #10b981;
          --slate-950: #020617;
        }

        /* ─── Water shimmer animation ─── */
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes wave-slow {
          0%, 100% { d: path("M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1380,20 1440,40 L1440,80 L0,80 Z"); }
          50% { d: path("M0,60 C160,20 380,80 540,50 C700,20 920,70 1080,50 C1240,30 1360,60 1440,40 L1440,80 L0,80 Z"); }
        }
        @keyframes float-drop {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-18px) scale(1.05); }
        }
        @keyframes ripple-out {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(14,165,233,0.4); }
          50% { box-shadow: 0 0 0 20px rgba(14,165,233,0); }
        }
        @keyframes marquee-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .shimmer-text {
          background: linear-gradient(90deg, #38bdf8 0%, #ffffff 40%, #22d3ee 60%, #38bdf8 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }

        .water-btn {
          background: linear-gradient(135deg, #0ea5e9 0%, #22d3ee 50%, #10b981 100%);
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .water-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(14,165,233,0.45);
        }
        .water-btn:active { transform: translateY(0px); }

        .glass-panel {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .glass-panel-light {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(14,165,233,0.15);
        }

        .card-hover {
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
        }
        .card-hover:hover {
          transform: translateY(-6px) scale(1.01);
          box-shadow: 0 20px 50px rgba(14,165,233,0.15);
        }

        .float-drop { animation: float-drop 3.5s ease-in-out infinite; }

        .marquee-track-left { animation: marquee-left 38s linear infinite; }
        .marquee-track-right { animation: marquee-right 44s linear infinite; }
        .marquee-track-left:hover,
        .marquee-track-right:hover { animation-play-state: paused; }

        .progress-bar-fill {
          background: linear-gradient(90deg, #0ea5e9, #22d3ee, #10b981);
          background-size: 200% 100%;
          animation: shimmer 2s linear infinite;
        }

        .ripple-ring {
          animation: ripple-out 2s ease-out infinite;
        }
        .ripple-ring:nth-child(2) { animation-delay: 0.7s; }
        .ripple-ring:nth-child(3) { animation-delay: 1.4s; }

        /* ─── Hero water background ─── */
        .hero-mesh {
          background:
            radial-gradient(ellipse 80% 60% at 20% 20%, rgba(14,165,233,0.22) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 80% 70%, rgba(6,182,212,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 50% 100%, rgba(16,185,129,0.12) 0%, transparent 70%),
            linear-gradient(160deg, #020c1b 0%, #041a2e 50%, #031320 100%);
        }

        /* ─── Scrollbar ─── */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #020617; }
        ::-webkit-scrollbar-thumb { background: #0ea5e9; border-radius: 3px; }

        /* ─── Responsive tweaks ─── */
        @media (max-width: 640px) {
          .marquee-track-left, .marquee-track-right {
            animation-duration: 24s;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen hero-mesh overflow-hidden flex flex-col">

        {/* Water drop particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { x: '8%', delay: 0, size: 14, opacity: 0.5 },
            { x: '22%', delay: 1.2, size: 10, opacity: 0.4 },
            { x: '45%', delay: 2.5, size: 16, opacity: 0.6 },
            { x: '65%', delay: 0.8, size: 12, opacity: 0.45 },
            { x: '80%', delay: 3.1, size: 18, opacity: 0.5 },
            { x: '92%', delay: 1.7, size: 10, opacity: 0.35 },
          ].map((d, i) => <FloatingDrop key={i} {...d} />)}
        </div>

        {/* Animated SVG water rings */}
        <div className="absolute top-16 right-8 sm:right-16 w-64 h-64 pointer-events-none">
          <div className="relative w-full h-full flex items-center justify-center">
            {[1,2,3].map(i => (
              <div key={i} className="ripple-ring absolute rounded-full border-2 border-sky-400/30"
                style={{ width: `${i * 70}px`, height: `${i * 70}px` }} />
            ))}
            <div className="relative z-10 text-5xl float-drop">💧</div>
          </div>
        </div>

        {/* Background SVG orbs */}
        <WaterDropsBg />

        {/* NAV */}
        <nav className="relative z-20 flex items-center justify-between px-5 sm:px-8 lg:px-12 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-lg" style={{ boxShadow: '0 4px 20px rgba(14,165,233,0.5)' }}>
              <span className="text-lg">💧</span>
            </div>
            <div>
              <span className="font-bold text-white text-lg tracking-tight">AuroWater</span>
              <span className="ml-1.5 text-xs text-sky-400 font-medium hidden sm:inline">ऑन-डिमांड</span>
            </div>
          </div>
          {/* <div className="hidden md:flex items-center gap-6 text-sm text-sky-100/80 font-medium">
            <Link href="/book?service=water_tanker" className="hover:text-white transition">Order Water</Link>
            <Link href="/book?service=plumbing" className="hover:text-white transition">Plumber</Link>
            <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
          </div> */}
          <div className="flex items-center gap-2.5">
            {/* <Link href="/auth/login" className="hidden sm:inline-flex text-xs font-semibold text-sky-200 hover:text-white transition px-3 py-1.5">Sign In</Link> */}
            <Link href="/auth/register" className="water-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg">
              Get Started →
            </Link>
          </div>
        </nav>

        {/* HERO CONTENT */}
        <motion.div
          className="relative z-10 flex-1 flex items-center"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

              {/* Left col */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 mb-5"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-xs font-semibold text-sky-300 tracking-wide uppercase">Now live in Delhi & UP</span>
                </motion.div>

                <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-cyan-300 mb-4">
                AuroWater · ऑन-डिमांड पानी + प्लम्बर
               </p>
               
                <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6">
                  <span className="shimmer-text block">शुद्ध पानी। सीधे आपके दरवाज़े तक।</span>
                  <span className="block text-white mt-1">Pure Water,</span>
                  <span className="block text-sky-300 mt-1">At Your Door.</span>
                </h1>


                <p className="text-base sm:text-lg text-sky-100/70 max-w-lg mb-8 leading-relaxed font-light">
                  On-demand water delivery + verified plumber service for students, families,
                  offices & events — all in one simple app.
                </p>

                {/* CTA row */}
                <div className="flex flex-wrap gap-3 mb-10">
                  <Link href="/book?service=water_tanker"
                    className="water-btn inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-xl">
                    💧 Order Water Now
                  </Link>
                  <Link href="/book?service=plumbing"
                    className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-white/5 backdrop-blur px-7 py-3.5 text-sm font-bold text-sky-100 hover:bg-white/10 transition">
                    🔧 Book a Plumber
                  </Link>
                </div>

                {/* Hindi sub-line */}
                <p className="text-sm text-sky-200/60 font-medium">
                  Cash + UPI · Hindi + English · 2hr Emergency Service
                </p>
              </motion.div>

              {/* Right col — Stats + card */}
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  {stats.map((s, i) => (
                    <motion.div
                      key={s.label}
                      className="glass-panel rounded-2xl px-5 py-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                    >
                      <div className="text-xl mb-1">{s.icon}</div>
                      <div className="text-2xl font-extrabold text-white">
                        <AnimatedStat value={s.value} />
                      </div>
                      <div className="text-xs text-sky-200/60 font-medium mt-0.5">{s.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Feature card */}
                <div className="glass-panel rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">Why AuroWater</span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      'Water cans at ₹10–15 with real-time availability',
                      'Verified local suppliers & background-checked plumbers',
                      'Emergency delivery in under 2 hours (select areas)',
                      'Hindi + English support · Cash + UPI payments',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-sky-100/80">
                        <span className="text-sky-400 mt-0.5 flex-shrink-0">✦</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Audience tags */}
                <div className="flex flex-wrap gap-2">
                  {['👨‍🎓 Students & PG', '🏠 Families', '🏢 Offices', '🎪 Events'].map(tag => (
                    <span key={tag} className="rounded-full border border-sky-400/25 bg-sky-400/8 px-3 py-1 text-xs font-medium text-sky-200">
                      {tag}
                    </span>
                  ))}
                </div> 
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Wave bottom */}
        <div className="relative z-10">
          <WaveDivider color="#f8fafc" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          TRUST BADGES STRIP
      ═══════════════════════════════════════════════════ */}
      <section className="bg-slate-50 py-5 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-5 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs sm:text-sm text-slate-600 font-semibold">
          {['✅ Verified Suppliers', '🚀 Free Delivery Always', '💳 Cash + UPI', '🗣️ Hindi & English', '⚡ 2hr Emergency Response', '🔒 Phone Verified'].map(b => (
            <span key={b} className="flex items-center gap-1">{b}</span>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          THREE PATHS / ROLES
      ═══════════════════════════════════════════════════ */}
      <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold tracking-widest text-sky-600 uppercase mb-3">Choose your role</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
              Three paths —<br className="hidden sm:block" /> pick the one that fits you
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {roles.map((role, i) => (
              <motion.div
                key={role.title}
                className="card-hover bg-white rounded-3xl p-7 shadow-sm border border-slate-100 flex flex-col"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center text-2xl mb-5 shadow-lg`}>
                  {role.icon}
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">{role.title}</h3>
                <p className="text-sm text-slate-500 mb-5 leading-relaxed">{role.desc}</p>
                <ul className="space-y-2 mb-7 flex-1">
                  {role.perks.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="text-emerald-500 font-bold">✓</span> {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={role.href}
                  className={`inline-flex items-center justify-center w-full rounded-2xl bg-gradient-to-r ${role.gradient} text-white px-6 py-3.5 text-sm font-bold shadow hover:opacity-90 transition`}
                >
                  {role.cta}
                </Link>
              </motion.div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            🛡️ All accounts are phone-verified. Suppliers & plumbers undergo KYC before activation.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          INTERACTIVE SERVICES SHOWCASE
      ═══════════════════════════════════════════════════ */}
      <div className="bg-white">
        <WaveDivider flip color="#020617" />
      </div>
      <section className="bg-slate-950 py-16 sm:py-20 lg:py-24 relative overflow-hidden">
        {/* subtle grid bg */}
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold tracking-widest text-sky-400 uppercase mb-3">What we offer</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Services for every water need
            </h2>
          </motion.div>

          {/* Service tabs */}
          <div className="flex justify-center gap-2 mb-10 flex-wrap">
            {services.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setActiveService(i)}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                  activeService === i
                    ? 'bg-sky-500 text-white shadow-lg'
                    : 'border border-sky-500/30 text-sky-300 hover:bg-sky-500/10'
                }`}
              >
                {s.icon} {s.title}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeService}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="glass-panel rounded-3xl p-8 sm:p-10 max-w-3xl mx-auto"
            >
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center text-3xl flex-shrink-0">
                  {services[activeService].icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-extrabold text-white">{services[activeService].title}</h3>
                    <span className="rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-bold px-3 py-0.5">
                      {services[activeService].badge}
                    </span>
                  </div>
                  <p className="text-sky-100/70 text-base mb-5">{services[activeService].body}</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {services[activeService].features.map(f => (
                      <span key={f} className="flex items-center gap-1.5 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-3 py-1 font-medium">
                        <span className="text-emerald-400">✓</span> {f}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={services[activeService].href}
                    className="water-btn inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-white shadow-lg"
                  >
                    {services[activeService].cta} →
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {services.map((_, i) => (
              <button key={i} onClick={() => setActiveService(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === activeService ? 'bg-sky-400 w-6' : 'bg-sky-700'}`} />
            ))}
          </div>
        </div>

        <div className="mt-16">
          <WaveDivider color="#f8fafc" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          WHY AUROWATER — 4 PILLARS
      ═══════════════════════════════════════════════════ */}
      <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold tracking-widest text-sky-600 uppercase mb-3">Our promise</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Why AuroWater</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '⚡', title: 'Same-day Service', desc: 'Book by 2PM, get service today in most areas.', color: 'amber' },
              { icon: '💰', title: 'No Hidden Charges', desc: 'Price shown = Price paid. Every single time.', color: 'emerald' },
              { icon: '✅', title: 'Verified Pros', desc: 'Every technician background-checked & ID-verified.', color: 'sky' },
              { icon: '📱', title: 'Easy Tracking', desc: 'Real-time updates from booking to completion.', color: 'violet' },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                className="card-hover bg-white rounded-3xl p-6 shadow-sm border border-slate-100"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-4
                  ${f.color === 'amber' ? 'bg-amber-50 text-amber-500' :
                    f.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' :
                    f.color === 'sky' ? 'bg-sky-50 text-sky-500' : 'bg-violet-50 text-violet-500'}
                `}>
                  {f.icon}
                </div>
                <h3 className="font-extrabold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          WHO WE SERVE
      ═══════════════════════════════════════════════════ */}
      <section className="bg-white py-14 sm:py-16">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12">
          <motion.h2
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Who we serve
          </motion.h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '👨‍🎓', label: 'Students & PG' },
              { icon: '👨‍💼', label: 'Professionals' },
              { icon: '🏠', label: 'Homeowners' },
              { icon: '🏢', label: 'Offices' },
              { icon: '🎪', label: 'Weddings' },
              { icon: '🍽️', label: 'Restaurants' },
              { icon: '🏗️', label: 'Construction' },
              { icon: '🏫', label: 'Schools' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="card-hover flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4 text-center cursor-default"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-700">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          REVIEWS MARQUEE
      ═══════════════════════════════════════════════════ */}
      <section className="bg-slate-50 py-14 sm:py-18 overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold tracking-widest text-sky-600 uppercase mb-3">Social proof</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Trusted by customers</h2>
            <p className="text-slate-500 mt-2">Real experiences from people across UP.</p>
          </motion.div>

          <div className="space-y-5">
            {[
              { cls: 'marquee-track-left', set: [...TRUST_REVIEWS, ...TRUST_REVIEWS] },
              { cls: 'marquee-track-right', set: [...TRUST_REVIEWS].reverse().concat([...TRUST_REVIEWS].reverse()) },
            ].map((row, ri) => (
              <div key={ri} className="overflow-hidden">
                <div className={`flex gap-4 ${row.cls}`}>
                  {row.set.map((r, idx) => <ReviewCard key={`${r.name}-${ri}-${idx}`} r={r} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════════ */}
      <div className="bg-slate-50">
        <WaveDivider flip color="#020617" />
      </div>
      <section className="bg-slate-950 py-16 sm:py-20 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(14,165,233,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative max-w-5xl mx-auto px-5 sm:px-8 lg:px-12">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold tracking-widest text-sky-400 uppercase mb-3">Simple process</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">How it works</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-10 left-[calc(33.33%-1rem)] right-[calc(33.33%-1rem)] h-0.5 bg-gradient-to-r from-sky-500/50 via-cyan-400/50 to-emerald-500/50" />

            {[
              { step: '01', icon: '📱', title: 'Order in 30 sec', body: 'Pick water or plumber, add your address, select a time slot.' },
              { step: '02', icon: '🚚', title: 'Auto-assignment', body: 'Nearest verified supplier or plumber is assigned instantly.' },
              { step: '03', icon: '✅', title: 'Done — pay easy', body: 'Track live, pay on completion via cash or UPI, rate your experience.' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="glass-panel rounded-3xl p-7 flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center text-2xl mb-4 shadow-lg z-10">
                  {item.icon}
                </div>
                <div className="text-xs font-extrabold text-sky-400 tracking-widest mb-2">{item.step}</div>
                <h3 className="text-base font-extrabold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-300/80 leading-relaxed">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="mt-16"><WaveDivider color="#f8fafc" /></div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FOUNDING MEMBERS
      ═══════════════════════════════════════════════════ */}
      <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="grid lg:grid-cols-[1.3fr,1fr] gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 mb-5">
                <span className="text-amber-500">🔥</span>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Limited spots</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
                Join Our First<br />
                <span className="text-sky-600">100 Founding Members</span>
              </h2>
              <p className="text-base text-slate-600 mb-5 leading-relaxed">
                पहले 100 customers में शामिल हों और हमेशा के लिए बेहतर पानी और प्रायोरिटी सर्विस पाएं।
              </p>
              <ul className="space-y-2.5 mb-7">
                {[
                  { icon: '🔒', text: 'Lifetime 10% discount on water and services' },
                  { icon: '⚡', text: 'Always priority delivery window' },
                  { icon: '🎁', text: 'First order free (up to ₹200)' },
                  { icon: '📞', text: 'Direct WhatsApp support with the core team' },
                ].map(item => (
                  <li key={item.text} className="flex items-center gap-3 text-sm text-slate-700">
                    <span className="text-base">{item.icon}</span> {item.text}
                  </li>
                ))}
              </ul>

              <div className="mb-2 flex justify-between text-sm font-semibold">
                <span className="text-slate-700">{claimed} of 100 spots claimed</span>
                <span className="text-sky-600">{100 - claimed} remaining</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
                <div className="h-full rounded-full progress-bar-fill transition-[width] duration-700"
                  style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-400">We'll confirm your spot by SMS/WhatsApp within 24h.</p>
            </motion.div>

            <motion.div
              className="glass-panel-light rounded-3xl p-7 sm:p-8 shadow-xl"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-xl font-extrabold text-slate-900 mb-5">Reserve your spot</h3>
              <form onSubmit={handleFoundingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
                    placeholder="e.g. Arjun Singh" required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Phone (WhatsApp)</label>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
                    placeholder="10-digit Indian mobile" required
                  />
                </div>
                <button
                  type="submit" disabled={submitting}
                  className="water-btn w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? '⏳ Saving…' : 'Join the first 100 →'}
                </button>
                {foundingMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-sm text-center font-medium ${foundingMsg.includes('Welcome') ? 'text-emerald-600' : 'text-red-500'}`}
                  >
                    {foundingMsg}
                  </motion.p>
                )}
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SUPPLIER & PLUMBER CTA
      ═══════════════════════════════════════════════════ */}
      <div className="bg-slate-50">
        <WaveDivider flip color="#020617" />
      </div>
      <section className="bg-slate-950 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
          <motion.h2
            className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-8"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Earn with AuroWater
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              {
                icon: '🚚',
                title: 'Supply Water',
                earn: '₹3,000–8,000/month',
                desc: 'Use your vehicle and local routes to deliver water cans. We handle customers — you focus on timely delivery.',
                cta: 'Apply as Supplier →',
                href: '/contact',
                border: 'border-emerald-400/30',
                bg: 'bg-emerald-500/8',
                btn: 'bg-gradient-to-r from-emerald-500 to-teal-400',
                text: 'text-emerald-100',
              },
              {
                icon: '🔧',
                title: 'Work as Plumber',
                earn: '₹4,000–15,000/month',
                desc: 'Get regular jobs for fittings, repair & boring. Transparent pricing and instant UPI payments.',
                cta: 'Apply as Plumber →',
                href: '/contact',
                border: 'border-sky-400/30',
                bg: 'bg-sky-500/8',
                btn: 'bg-gradient-to-r from-sky-500 to-cyan-400',
                text: 'text-sky-100',
              },
            ].map(c => (
              <motion.div
                key={c.title}
                className={`rounded-3xl border ${c.border} ${c.bg} p-7 sm:p-8 backdrop-blur`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="text-3xl mb-3">{c.icon}</div>
                <h3 className={`text-xl font-extrabold mb-1 ${c.text}`}>{c.title}</h3>
                <div className="text-2xl font-extrabold text-white mb-3">{c.earn}</div>
                <p className={`text-sm mb-5 leading-relaxed ${c.text} opacity-80`}>{c.desc}</p>
                <Link
                  href={c.href}
                  className={`inline-flex items-center justify-center rounded-full ${c.btn} text-white px-6 py-3 text-sm font-bold shadow hover:opacity-90 transition`}
                >
                  {c.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════ */}
      <section className="relative bg-slate-950 py-16 sm:py-20 overflow-hidden">
        {/* water drops */}
        <div className="absolute inset-0 pointer-events-none">
          <WaterDropsBg />
        </div>
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold tracking-widest text-sky-400 uppercase mb-4">Trusted across North India</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
              Water shouldn't be<br className="hidden sm:block" /> a daily headache.
            </h2>
            <p className="text-base sm:text-lg text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              AuroWater keeps your cans filled, pumps running, and events flowing — so you can focus on life, not logistics.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/book"
                className="water-btn inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-extrabold text-white shadow-xl"
              >
                💧 Start in 30 seconds →
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-slate-500/60 bg-white/5 px-8 py-4 text-base font-bold text-slate-100 hover:bg-white/10 transition backdrop-blur"
              >
                View transparent pricing
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════ */}
      <footer className="bg-slate-950 border-t border-slate-800/60 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-lg">💧</span>
            <span className="font-bold text-slate-300">AuroWater</span>
            <span className="text-slate-600">· Delhi, UP</span>
          </div>
          <div className="flex flex-wrap justify-center gap-5">
            <Link href="/pricing" className="hover:text-slate-300 transition">Pricing</Link>
            <Link href="/contact" className="hover:text-slate-300 transition">Contact</Link>
            <Link href="/auth/register?role=supplier" className="hover:text-slate-300 transition">Become Supplier</Link>
            <Link href="/auth/register?role=technician" className="hover:text-slate-300 transition">Become Plumber</Link>
          </div>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} AuroWater. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}


