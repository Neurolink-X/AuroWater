// 'use client';

// import Link from 'next/link';
// import React, { useEffect, useMemo, useState } from 'react';
// import { toast } from 'sonner';
// import { useForm } from 'react-hook-form';
// import { z } from 'zod';
// import { zodResolver } from '@hookform/resolvers/zod';

// const FALLBACK = {
//   support_email: 'support.aurotap@gmail.com',
//   secondary_email: 'aurotap@gmail.com',
//   phone_primary: '9889305803',
//   phone_secondary: '',
//   office_address: 'Kanpur, Uttar Pradesh',
//   working_hours: 'Mon–Sat, 8AM–8PM IST',
//   brand_name: 'Auro Water',
// };

// const schema = z.object({
//   name: z.string().min(2, 'Name is required.'),
//   email: z.string().email('Enter a valid email.'),
//   phone: z
//     .string()
//     .min(10, 'Enter a valid phone number.')
//     .max(15, 'Enter a valid phone number.')
//     .refine((v) => /^[0-9]+$/.test(v.replace(/\D/g, '')), 'Phone must be digits.'),
//   subject: z.enum([
//     'General',
//     'Booking Help',
//     'Technician Registration',
//     'Supplier Partnership',
//     'Complaint',
//     'Other',
//   ]),
//   message: z.string().min(10, 'Message must be at least 10 characters.'),
// });

// type FormValues = z.infer<typeof schema>;

// export default function ContactPage() {
//   const whatsappHref = useMemo(() => 'https://wa.me/919889305803', []);

//   const [settings, setSettings] = useState<typeof FALLBACK | null>(null);
//   const [settingsLoading, setSettingsLoading] = useState(true);
//   const [submitted, setSubmitted] = useState(false);
//   const [loading, setLoading] = useState(false);

//   const {
//     register,
//     handleSubmit,
//     reset,
//     formState: { errors },
//     setValue,
//   } = useForm<FormValues>({
//     resolver: zodResolver(schema),
//     defaultValues: {
//       name: '',
//       email: '',
//       phone: '',
//       subject: 'General',
//       message: '',
//     },
//   });

//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch('/api/settings', { cache: 'no-store' });
//         const json = await res.json();
//         setSettings(json?.data || FALLBACK);
//       } catch {
//         setSettings(FALLBACK);
//       } finally {
//         setSettingsLoading(false);
//       }
//     })();
//   }, []);

//   // Prefill subject from query param.
//   useEffect(() => {
//     if (typeof window === 'undefined') return;
//     const sp = new URLSearchParams(window.location.search);
//     const raw = sp.get('subject');
//     if (!raw) return;
//     const map: Record<string, FormValues['subject']> = {
//       technician: 'Technician Registration',
//       supplier: 'Supplier Partnership',
//       booking: 'Booking Help',
//       general: 'General',
//       complaint: 'Complaint',
//     };
//     const next = map[raw.toLowerCase()];
//     if (!next) return;
//     setValue('subject', next);
//     setTimeout(() => {
//       document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
//     }, 80);
//   }, [setValue]);

//   const onSubmit = async (values: FormValues) => {
//     if (loading) return;
//     setLoading(true);
//     setSubmitted(false);
//     try {
//       await new Promise((r) => setTimeout(r, 1500));
//       setSubmitted(true);
//       toast.success('Message sent! We will reply within 24 hours.');
//       reset();
//     } catch {
//       toast.error('Something went wrong. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen gradient-section">
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-16">
//         <div className="mb-7">
//           <h1 className="text-[clamp(1.75rem,5vw,3.5rem)] font-extrabold text-[#0F1C18]">Get in Touch</h1>
//           <p className="text-base sm:text-lg text-slate-600 mt-3">
//             Have a question or need support? Send us a message.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           <div className="lg:col-span-2">
//             <div id="contact-form" className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
//               <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F1C18]">Contact form</h2>
//               <p className="text-slate-600 mt-2">We’ll reply within 24 hours.</p>

//               {submitted ? (
//                 <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 font-semibold">
//                   ✅ Message sent! We'll reply within 24 hours.
//                 </div>
//               ) : (
//                 <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
//                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                     <div>
//                       <label className="text-sm font-semibold text-slate-700">Name</label>
//                       <input
//                         {...register('name')}
//                         placeholder="Your name"
//                         className={[
//                           'mt-2 w-full rounded-xl border px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]',
//                           errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
//                         ].join(' ')}
//                       />
//                       {errors.name && <div className="text-xs text-red-700 mt-1">{errors.name.message}</div>}
//                     </div>
//                     <div>
//                       <label className="text-sm font-semibold text-slate-700">Email</label>
//                       <input
//                         {...register('email')}
//                         type="email"
//                         placeholder="you@example.com"
//                         className={[
//                           'mt-2 w-full rounded-xl border px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]',
//                           errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
//                         ].join(' ')}
//                       />
//                       {errors.email && <div className="text-xs text-red-700 mt-1">{errors.email.message}</div>}
//                     </div>
//                   </div>

//                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                     <div>
//                       <label className="text-sm font-semibold text-slate-700">Phone</label>
//                       <input
//                         {...register('phone')}
//                         inputMode="numeric"
//                         placeholder="9XXXXXXXXX"
//                         className={[
//                           'mt-2 w-full rounded-xl border px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]',
//                           errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
//                         ].join(' ')}
//                       />
//                       {errors.phone && <div className="text-xs text-red-700 mt-1">{errors.phone.message}</div>}
//                     </div>
//                     <div>
//                       <label className="text-sm font-semibold text-slate-700">Subject</label>
//                       <select
//                         {...register('subject')}
//                         className={[
//                           'mt-2 w-full rounded-xl border px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]',
//                           errors.subject ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
//                         ].join(' ')}
//                       >
//                         <option value="General">General</option>
//                         <option value="Booking Help">Booking Help</option>
//                         <option value="Technician Registration">Technician Registration</option>
//                         <option value="Supplier Partnership">Supplier Partnership</option>
//                         <option value="Complaint">Complaint</option>
//                         <option value="Other">Other</option>
//                       </select>
//                       {errors.subject && <div className="text-xs text-red-700 mt-1">{errors.subject.message}</div>}
//                     </div>
//                   </div>

//                   <div>
//                     <label className="text-sm font-semibold text-slate-700">Message</label>
//                     <textarea
//                       {...register('message')}
//                       rows={5}
//                       placeholder="Tell us what you need..."
//                       className={[
//                         'mt-2 w-full rounded-xl border px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]',
//                         errors.message ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
//                       ].join(' ')}
//                     />
//                     {errors.message && <div className="text-xs text-red-700 mt-1">{errors.message.message}</div>}
//                   </div>

//                   <button
//                     type="submit"
//                     disabled={loading}
//                     className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
//                   >
//                     {loading ? 'Sending...' : 'Send Message'}
//                   </button>
//                 </form>
//               )}
//             </div>
//           </div>

//           <div className="space-y-6">
//             <div className="rounded-2xl bg-gradient-to-r from-[#0D9B6C] to-[#38BDF8] text-white p-6 shadow-card relative overflow-hidden">
//               <div className="hero-water-bg opacity-70" />
//               <div className="relative">
//                 <div className="font-extrabold text-xl flex items-center gap-2">
//                   <span>📱</span> Chat on WhatsApp
//                 </div>
//                 <div className="text-white/90 mt-2 text-sm">Usually replies within 30 minutes.</div>
//                 <a
//                   href={whatsappHref}
//                   target="_blank"
//                   rel="noopener noreferrer"
//                   className="mt-5 inline-flex items-center justify-center w-full rounded-xl bg-white text-[#0D9B6C] font-extrabold py-3 hover:bg-white/90 active:scale-95 transition-all"
//                 >
//                   Start WhatsApp chat
//                 </a>
//                 <Link
//                   href="/contact?subject=technician"
//                   className="mt-4 inline-block w-full text-center text-white/90 hover:text-white underline"
//                 >
//                   For technician registration
//                 </Link>
//               </div>
//             </div>

//             <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6">
//               <h2 className="text-lg font-extrabold text-[#0F1C18]">Contact info</h2>
//               <div className="mt-4 space-y-3 text-sm text-slate-700">
//                 <div>📞 Phone: {settingsLoading ? 'Loading...' : settings?.phone_primary || FALLBACK.phone_primary}</div>
//                 <div>✉️ Email: {settingsLoading ? 'Loading...' : settings?.support_email || FALLBACK.support_email}</div>
//                 <div>📍 Address: {settingsLoading ? 'Loading...' : settings?.office_address || FALLBACK.office_address}</div>
//                 <div>🕐 Hours: {settingsLoading ? 'Loading...' : settings?.working_hours || FALLBACK.working_hours}</div>
//               </div>
//             </div>

//             <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6">
//               <h2 className="text-lg font-extrabold text-[#0F1C18]">Support</h2>
//               <div className="mt-3 text-sm text-slate-600">
//                 For booking help, use the Book flow. For onboarding, send a message or WhatsApp us.
//               </div>
//             </div>
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }





'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

/* ─────────────────────────────────────────────
   SCHEMA & TYPES
───────────────────────────────────────────── */
const FALLBACK = {
  support_email: 'support.aurotap@gmail.com',
  secondary_email: 'aurotap@gmail.com',
  phone_primary: '9889305803',
  phone_secondary: '',
  office_address: 'Kanpur, Uttar Pradesh',
  working_hours: 'Mon–Sat, 8AM–8PM IST',
  brand_name: 'Auro Water',
};

const schema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Enter a valid email.'),
  phone: z
    .string()
    .min(10, 'Enter a valid phone number.')
    .max(15, 'Enter a valid phone number.')
    .refine((v) => /^[0-9]+$/.test(v.replace(/\D/g, '')), 'Phone must be digits.'),
  subject: z.enum(['General', 'Booking Help', 'Technician Registration', 'Supplier Partnership', 'Complaint', 'Other']),
  message: z.string().min(10, 'Message must be at least 10 characters.'),
});

type FormValues = z.infer<typeof schema>;

/* ─────────────────────────────────────────────
   INLINE SVG ICONS
───────────────────────────────────────────── */
const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1.84h3a2 2 0 012 1.72c.13 1 .38 1.98.74 2.92a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.94.36 1.92.61 2.92.74A2 2 0 0122 16.92z"/>
  </svg>
);
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
  </svg>
);
const IconPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
);
const IconWhatsApp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const IconSend = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconCheck = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

/* ─────────────────────────────────────────────
   PAGE COMPONENT
───────────────────────────────────────────── */
export default function ContactPage() {
  const whatsappHref = useMemo(() => 'https://wa.me/919889305803', []);
  const [settings, setSettings] = useState<typeof FALLBACK | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', subject: 'General', message: '' },
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        const json = await res.json();
        setSettings(json?.data || FALLBACK);
      } catch { setSettings(FALLBACK); }
      finally { setSettingsLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get('subject');
    if (!raw) return;
    const map: Record<string, FormValues['subject']> = {
      technician: 'Technician Registration',
      supplier: 'Supplier Partnership',
      booking: 'Booking Help',
      general: 'General',
      complaint: 'Complaint',
    };
    const next = map[raw.toLowerCase()];
    if (next) {
      setValue('subject', next);
      setTimeout(() => {
        document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [setValue]);

  const onSubmit = async (values: FormValues) => {
    if (loading) return;
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setSubmitted(true);
      toast.success("Message sent! We\u2019ll reply within 24 hours.");
      reset();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const info = settings ?? FALLBACK;

  const fieldClass = (name: string, hasError: boolean) => [
    'ct-input',
    hasError ? 'ct-input-error' : '',
    focusedField === name ? 'ct-input-focused' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* ══════════════════════════════════════════
          STYLES
      ══════════════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

        /* ── Reset/base ── */
        .ct-page { font-family: 'DM Sans', sans-serif; min-height: 100vh; background: #F4F8F6; }
        .ct-syne { font-family: 'Syne', sans-serif; }

        /* ══ HERO ══════════════════════════════════════ */
        .ct-hero {
          position: relative;
          background: linear-gradient(160deg, #062D1E 0%, #0A5438 45%, #0D7A52 100%);
          overflow: hidden;
          padding: 72px 24px 110px;
          text-align: center;
        }

        /* Animated SVG waves */
        .ct-waves {
          position: absolute;
          bottom: -2px; left: 0; right: 0;
          height: 110px;
          pointer-events: none;
        }
        .ct-wave { animation: waveMove 7s ease-in-out infinite; }
        .ct-wave-2 { animation: waveMove 9s ease-in-out infinite reverse; opacity: 0.6; }
        .ct-wave-3 { animation: waveMove 5s ease-in-out infinite; opacity: 0.35; }

        @keyframes waveMove {
          0%, 100% { transform: translateX(0); }
          50%       { transform: translateX(-40px); }
        }

        /* Floating droplet particles */
        .ct-drop {
          position: absolute;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          opacity: 0;
          animation: dropFloat 6s ease-in-out infinite;
        }
        @keyframes dropFloat {
          0%   { opacity: 0;   transform: rotate(-45deg) translateY(0) scale(0.5); }
          20%  { opacity: 0.6; }
          80%  { opacity: 0.3; }
          100% { opacity: 0;   transform: rotate(-45deg) translateY(-120px) scale(1); }
        }

        /* Radial glow */
        .ct-hero-glow {
          position: absolute;
          width: 600px; height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(52,211,153,0.18) 0%, transparent 70%);
          top: -100px; left: 50%; transform: translateX(-50%);
          pointer-events: none;
        }

        /* Grid lines overlay */
        .ct-grid-lines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }

        .ct-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(52,211,153,0.12);
          border: 1px solid rgba(52,211,153,0.3);
          padding: 6px 16px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          color: #6EE7B7;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 20px;
          animation: fadeDown 0.6s ease both;
        }

        .ct-hero-title {
          font-family: 'Syne', sans-serif;
          font-weight: 900;
          font-size: clamp(2.4rem, 5.5vw, 4rem);
          color: #fff;
          letter-spacing: -2px;
          line-height: 1.0;
          margin: 0 0 16px;
          animation: fadeDown 0.6s 0.1s ease both;
        }
        .ct-hero-title span { color: #34D399; }

        .ct-hero-sub {
          font-size: clamp(0.95rem, 2vw, 1.1rem);
          color: rgba(255,255,255,0.65);
          max-width: 460px;
          margin: 0 auto;
          line-height: 1.65;
          animation: fadeDown 0.6s 0.2s ease both;
        }

        /* Hero stat chips */
        .ct-hero-stats {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 32px;
          animation: fadeDown 0.6s 0.3s ease both;
        }
        .ct-stat-chip {
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.14);
          backdrop-filter: blur(8px);
          padding: 8px 16px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
        }
        .ct-stat-chip-dot { width: 7px; height: 7px; border-radius: 50%; background: #34D399; }

        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ══ BODY ═══════════════════════════════════════ */
        .ct-body {
          max-width: 1160px;
          margin: -56px auto 0;
          padding: 0 24px 80px;
          position: relative;
          z-index: 10;
        }

        .ct-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 24px;
          align-items: start;
        }

        /* ══ FORM CARD ══════════════════════════════════ */
        .ct-form-card {
          background: #fff;
          border-radius: 24px;
          border: 1px solid #E2EDE9;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 20px 60px rgba(13,155,108,0.08);
          overflow: hidden;
          animation: cardRise 0.55s 0.1s ease both;
        }

        @keyframes cardRise {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ct-form-header {
          padding: 28px 32px 0;
          border-bottom: 1px solid #F0F7F4;
          padding-bottom: 20px;
        }

        .ct-form-title {
          font-family: 'Syne', sans-serif;
          font-weight: 900;
          font-size: 1.6rem;
          color: #0A2E1E;
          letter-spacing: -0.5px;
          margin: 0 0 4px;
        }

        .ct-form-sub { font-size: 14px; color: #6B7280; font-weight: 500; }

        .ct-form-body { padding: 28px 32px 32px; }

        /* ── Input ── */
        .ct-field { display: flex; flex-direction: column; gap: 6px; }
        .ct-label {
          font-size: 12px;
          font-weight: 700;
          color: #374151;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .ct-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1.5px solid #E5E7EB;
          background: #FAFAFA;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #111827;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .ct-input:focus {
          border-color: #0D9B6C;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(13,155,108,0.1);
        }
        .ct-input-error {
          border-color: #FCA5A5 !important;
          background: #FFF8F8 !important;
        }
        .ct-input::placeholder { color: #B0BAC4; }

        textarea.ct-input { resize: none; }

        select.ct-input {
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
          cursor: pointer;
        }

        .ct-error { font-size: 11px; color: #DC2626; font-weight: 600; margin-top: 2px; }

        .ct-field-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        /* ── Submit button ── */
        .ct-submit {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 15px 28px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #0D9B6C 0%, #059652 100%);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(13,155,108,0.32);
          transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
          letter-spacing: -0.2px;
        }
        .ct-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(13,155,108,0.40); }
        .ct-submit:active:not(:disabled) { transform: scale(0.98); }
        .ct-submit:disabled { opacity: 0.65; cursor: not-allowed; }

        .ct-submit-spinner {
          width: 16px; height: 16px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Success state ── */
        .ct-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 48px 24px;
          gap: 16px;
          animation: fadeDown 0.4s ease both;
        }
        .ct-success-icon {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0D9B6C, #34D399);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          box-shadow: 0 8px 24px rgba(13,155,108,0.3);
        }
        .ct-success-title {
          font-family: 'Syne', sans-serif;
          font-weight: 900;
          font-size: 1.4rem;
          color: #0A2E1E;
          letter-spacing: -0.5px;
        }
        .ct-success-sub { font-size: 14px; color: #6B7280; max-width: 320px; line-height: 1.6; }

        /* ══ SIDEBAR ════════════════════════════════════ */
        .ct-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: cardRise 0.55s 0.2s ease both;
        }

        /* WhatsApp card */
        .ct-wa-card {
          border-radius: 22px;
          overflow: hidden;
          position: relative;
          background: linear-gradient(145deg, #062D1E 0%, #0A5438 60%, #0D7A52 100%);
          padding: 26px;
        }
        /* animated water blob inside card */
        .ct-wa-blob {
          position: absolute;
          width: 180px; height: 180px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(52,211,153,0.2), transparent 70%);
          bottom: -40px; right: -40px;
          pointer-events: none;
          animation: blobPulse 4s ease-in-out infinite;
        }
        @keyframes blobPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.15); }
        }

        .ct-wa-title {
          font-family: 'Syne', sans-serif;
          font-weight: 900;
          font-size: 1.2rem;
          color: #fff;
          letter-spacing: -0.3px;
          margin: 0 0 6px;
        }
        .ct-wa-sub { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 20px; line-height: 1.5; }

        .ct-wa-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: 100%;
          padding: 13px 20px;
          border-radius: 12px;
          background: #25D366;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          transition: transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 14px rgba(37,211,102,0.35);
        }
        .ct-wa-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,211,102,0.4); }

        .ct-wa-link {
          display: block;
          text-align: center;
          margin-top: 14px;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s;
        }
        .ct-wa-link:hover { color: #34D399; }

        /* Info card */
        .ct-info-card {
          background: #fff;
          border-radius: 22px;
          border: 1px solid #E2EDE9;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 12px 36px rgba(13,155,108,0.06);
          padding: 24px;
        }
        .ct-info-title {
          font-family: 'Syne', sans-serif;
          font-weight: 900;
          font-size: 1rem;
          color: #0A2E1E;
          letter-spacing: -0.2px;
          margin: 0 0 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #F0F7F4;
        }
        .ct-info-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #F8FAF9;
        }
        .ct-info-item:last-child { border-bottom: none; padding-bottom: 0; }
        .ct-info-icon {
          width: 34px; height: 34px;
          border-radius: 10px;
          background: #F0FDF9;
          border: 1px solid #D1FAE5;
          display: flex; align-items: center; justify-content: center;
          color: #0D9B6C;
          flex-shrink: 0;
        }
        .ct-info-label { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
        .ct-info-value { font-size: 13px; font-weight: 600; color: #1F2937; }

        /* Support note card */
        .ct-note-card {
          background: linear-gradient(135deg, #F0FDF9 0%, #ECFDF5 100%);
          border: 1px solid #D1FAE5;
          border-radius: 18px;
          padding: 20px;
        }
        .ct-note-card p {
          font-size: 13px;
          color: #065F46;
          line-height: 1.6;
          margin: 0;
        }
        .ct-note-card strong { font-weight: 700; }

        /* ══ RESPONSIVE ═════════════════════════════════ */
        @media (max-width: 960px) {
          .ct-grid { grid-template-columns: 1fr; }
          .ct-sidebar { order: -1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .ct-wa-card { grid-column: 1 / -1; }
        }
        @media (max-width: 640px) {
          .ct-hero { padding: 52px 20px 90px; }
          .ct-body { padding: 0 16px 60px; margin-top: -44px; }
          .ct-form-header { padding: 22px 20px 18px; }
          .ct-form-body { padding: 22px 20px 24px; }
          .ct-field-grid-2 { grid-template-columns: 1fr; gap: 14px; }
          .ct-sidebar { grid-template-columns: 1fr; }
          .ct-form-card { border-radius: 20px; }
        }
        @media (max-width: 360px) {
          .ct-hero-title { font-size: 2rem; letter-spacing: -1px; }
          .ct-stat-chip { font-size: 11px; padding: 7px 12px; }
        }
      `}</style>

      <div className="ct-page">

        {/* ══ HERO ══════════════════════════════════════ */}
        <div className="ct-hero">
          <div className="ct-hero-glow" />
          <div className="ct-grid-lines" />

          {/* Floating water droplets */}
          {[
            { left: '8%',  top: '20%', size: 10, color: 'rgba(52,211,153,0.5)',  delay: '0s',   dur: '5s'  },
            { left: '18%', top: '55%', size: 7,  color: 'rgba(52,211,153,0.35)', delay: '1.2s', dur: '7s'  },
            { left: '82%', top: '25%', size: 12, color: 'rgba(52,211,153,0.4)',  delay: '0.5s', dur: '6s'  },
            { left: '75%', top: '60%', size: 8,  color: 'rgba(52,211,153,0.3)',  delay: '2s',   dur: '5.5s'},
            { left: '50%', top: '10%', size: 6,  color: 'rgba(52,211,153,0.45)', delay: '0.8s', dur: '6.5s'},
            { left: '35%', top: '70%', size: 9,  color: 'rgba(52,211,153,0.3)',  delay: '1.8s', dur: '7.5s'},
          ].map((d, i) => (
            <div
              key={i}
              className="ct-drop"
              style={{
                left: d.left, top: d.top,
                width: d.size, height: d.size,
                background: d.color,
                animationDelay: d.delay,
                animationDuration: d.dur,
              }}
            />
          ))}

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="ct-hero-eyebrow">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
              We reply within 24 hours
            </div>

            <h1 className="ct-hero-title">
              Talk to <span>AuroWater</span><br />
              We're here for you.
            </h1>

            <p className="ct-hero-sub">
              Whether it's a booking issue, partnership query, or you want to join our technician network — we've got you covered.
            </p>

            <div className="ct-hero-stats">
              {[
                '24hr response guarantee',
                'WhatsApp support',
                '13 cities covered',
              ].map((s) => (
                <div key={s} className="ct-stat-chip">
                  <span className="ct-stat-chip-dot" />
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Animated wave SVG */}
          <svg className="ct-waves" viewBox="0 0 1440 110" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path className="ct-wave-3" fill="#F4F8F6"
              d="M0,60 C180,90 360,20 540,60 C720,100 900,30 1080,60 C1260,90 1380,50 1440,60 L1440,110 L0,110 Z" />
            <path className="ct-wave-2" fill="#F4F8F6" opacity="0.6"
              d="M0,75 C200,45 400,95 600,70 C800,45 1000,90 1200,70 C1320,58 1400,72 1440,75 L1440,110 L0,110 Z" />
            <path className="ct-wave" fill="#F4F8F6"
              d="M0,90 C160,70 320,105 480,90 C640,75 800,100 960,88 C1120,76 1300,95 1440,90 L1440,110 L0,110 Z" />
          </svg>
        </div>

        {/* ══ BODY ══════════════════════════════════════ */}
        <div className="ct-body">
          <div className="ct-grid">

            {/* ─── FORM CARD ─────────────────────────── */}
            <div className="ct-form-card" id="contact-form">
              <div className="ct-form-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 className="ct-form-title">Send us a message</h2>
                    <p className="ct-form-sub">Fill in the form and we'll get back to you within 24 hours.</p>
                  </div>
                  {/* accent droplet decoration */}
                  <div style={{ width: 48, height: 48, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: 'linear-gradient(135deg, #0D9B6C, #34D399)', opacity: 0.15, flexShrink: 0 }} />
                </div>
              </div>

              <div className="ct-form-body">
                {submitted ? (
                  <div className="ct-success">
                    <div className="ct-success-icon"><IconCheck /></div>
                    <div className="ct-success-title">Message sent!</div>
                    <p className="ct-success-sub">We've received your message and will reply to you within 24 hours. Check your inbox.</p>
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, border: '1.5px solid #0D9B6C', background: 'transparent', color: '#0D9B6C', fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                    {/* Row 1: Name + Email */}
                    <div className="ct-field-grid-2">
                      <div className="ct-field">
                        <label className="ct-label">Full Name</label>
                        <input
                          {...register('name')}
                          placeholder="e.g. Rahul Sharma"
                          className={fieldClass('name', !!errors.name)}
                          onFocus={() => setFocusedField('name')}
                          onBlur={() => setFocusedField(null)}
                        />
                        {errors.name && <span className="ct-error">{errors.name.message}</span>}
                      </div>
                      <div className="ct-field">
                        <label className="ct-label">Email Address</label>
                        <input
                          {...register('email')}
                          type="email"
                          placeholder="you@example.com"
                          className={fieldClass('email', !!errors.email)}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField(null)}
                        />
                        {errors.email && <span className="ct-error">{errors.email.message}</span>}
                      </div>
                    </div>

                    {/* Row 2: Phone + Subject */}
                    <div className="ct-field-grid-2">
                      <div className="ct-field">
                        <label className="ct-label">Phone Number</label>
                        <input
                          {...register('phone')}
                          inputMode="numeric"
                          placeholder="9XXXXXXXXX"
                          className={fieldClass('phone', !!errors.phone)}
                          onFocus={() => setFocusedField('phone')}
                          onBlur={() => setFocusedField(null)}
                        />
                        {errors.phone && <span className="ct-error">{errors.phone.message}</span>}
                      </div>
                      <div className="ct-field">
                        <label className="ct-label">Subject</label>
                        <select
                          {...register('subject')}
                          className={fieldClass('subject', !!errors.subject)}
                          onFocus={() => setFocusedField('subject')}
                          onBlur={() => setFocusedField(null)}
                        >
                          <option value="General">General Enquiry</option>
                          <option value="Booking Help">Booking Help</option>
                          <option value="Technician Registration">Technician Registration</option>
                          <option value="Supplier Partnership">Supplier Partnership</option>
                          <option value="Complaint">Complaint</option>
                          <option value="Other">Other</option>
                        </select>
                        {errors.subject && <span className="ct-error">{errors.subject.message}</span>}
                      </div>
                    </div>

                    {/* Message */}
                    <div className="ct-field">
                      <label className="ct-label">Your Message</label>
                      <textarea
                        {...register('message')}
                        rows={5}
                        placeholder="Tell us what you need help with..."
                        className={fieldClass('message', !!errors.message)}
                        onFocus={() => setFocusedField('message')}
                        onBlur={() => setFocusedField(null)}
                      />
                      {errors.message && <span className="ct-error">{errors.message.message}</span>}
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={loading} className="ct-submit">
                      {loading ? (
                        <>
                          <div className="ct-submit-spinner" />
                          Sending your message...
                        </>
                      ) : (
                        <>
                          <IconSend />
                          Send Message
                          <span style={{ background: 'rgba(255,255,255,0.18)', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>→</span>
                        </>
                      )}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                      We typically respond within 24 hours · Your data is safe with us
                    </p>

                  </form>
                )}
              </div>
            </div>

            {/* ─── SIDEBAR ───────────────────────────── */}
            <div className="ct-sidebar">

              {/* WhatsApp card */}
              <div className="ct-wa-card">
                <div className="ct-wa-blob" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(37,211,102,0.2)', border: '1px solid rgba(37,211,102,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366' }}>
                      <IconWhatsApp />
                    </div>
                    <div>
                      <div className="ct-wa-title">Chat on WhatsApp</div>
                    </div>
                  </div>
                  <p className="ct-wa-sub">Get instant help from our team. Usually replies within 30 minutes during working hours.</p>

                  {/* availability pill */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', padding: '5px 12px', borderRadius: 99, marginBottom: 18 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block', boxShadow: '0 0 0 2px rgba(52,211,153,0.3)', animation: 'blobPulse 1.5s infinite' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#6EE7B7', letterSpacing: '0.05em' }}>Online · Mon–Sat 8AM–8PM</span>
                  </div>

                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="ct-wa-btn">
                    <IconWhatsApp />
                    Start WhatsApp Chat
                  </a>

                  <Link href="/contact?subject=technician" className="ct-wa-link">
                    Technician registration →
                  </Link>
                </div>
              </div>

              {/* Contact info card */}
              <div className="ct-info-card">
                <div className="ct-info-title">Contact Details</div>
                {[
                  { icon: <IconPhone />, label: 'Phone', value: settingsLoading ? 'Loading…' : (info.phone_primary || FALLBACK.phone_primary) },
                  { icon: <IconMail />,  label: 'Email', value: settingsLoading ? 'Loading…' : (info.support_email || FALLBACK.support_email) },
                  { icon: <IconPin />,   label: 'Address', value: settingsLoading ? 'Loading…' : (info.office_address || FALLBACK.office_address) },
                  { icon: <IconClock />, label: 'Working Hours', value: settingsLoading ? 'Loading…' : (info.working_hours || FALLBACK.working_hours) },
                ].map((item) => (
                  <div key={item.label} className="ct-info-item">
                    <div className="ct-info-icon">{item.icon}</div>
                    <div>
                      <div className="ct-info-label">{item.label}</div>
                      <div className="ct-info-value">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Support note */}
              <div className="ct-note-card">
                <p>
                  <strong>For bookings</strong>, use the Book flow directly. For technician onboarding or supplier partnerships, drop us a message or WhatsApp — we'll set up a call.
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </>
  );
}