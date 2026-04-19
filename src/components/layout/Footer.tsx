// import Link from 'next/link';
// import React from 'react';
// import { MessageCircle } from 'lucide-react';

// const InstagramIcon = ({ size = 18 }: { size?: number }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
//     <path
//       d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
//       stroke="currentColor"
//       strokeWidth="1.8"
//       strokeLinejoin="round"
//     />
//     <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.8" />
//     <path d="M17.5 6.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
//   </svg>
// );

// const FacebookIcon = ({ size = 18 }: { size?: number }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
//     <path
//       d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v3H7v3h3v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1Z"
//       stroke="currentColor"
//       strokeWidth="1.8"
//       strokeLinejoin="round"
//     />
//   </svg>
// );

// const social = [
//   { Icon: InstagramIcon, href: 'https://instagram.com', label: 'Instagram' },
//   { Icon: FacebookIcon, href: 'https://facebook.com', label: 'Facebook' },
// ];

// export default function Footer() {
//   return (
//     <footer className="bg-[var(--footer-bg)] text-white">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
//           <div className="space-y-3">
//             <div className="flex items-center gap-2">
//               <span className="text-2xl">💧</span>
//               <div className="font-extrabold text-xl">AuroWater</div>
//             </div>
//             <p className="text-sm text-white/80">
//               Reliable water supply and water-system services for India.
//             </p>
//             <div className="flex items-center gap-2 pt-2">
//               <a
//                 href="https://wa.me/919889305803"
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 transition"
//                 aria-label="WhatsApp"
//               >
//                 <MessageCircle size={18} />
//               </a>
//               {social.map(({ Icon, href, label }) => (
//                 <a
//                   key={label}
//                   href={href}
//                   target="_blank"
//                   rel="noopener noreferrer"
//                   className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 transition"
//                   aria-label={label}
//                 >
//                   <Icon size={18} />
//                 </a>
//               ))}
//             </div>
//           </div>

//           <div className="space-y-3">
//             <div className="font-bold text-white/95">Quick Links</div>
//             <div className="flex flex-col gap-2 text-sm text-white/80">
//               <Link href="/" className="hover:text-white transition">Home</Link>
//               <Link href="/services" className="hover:text-white transition">Services</Link>
//               <Link href="/how-it-works" className="hover:text-white transition">How It Works</Link>
//               <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
//               <Link href="/about" className="hover:text-white transition">About</Link>
//               <Link href="/contact" className="hover:text-white transition">Contact</Link>
//               <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
//             </div>
//           </div>

//           <div className="space-y-3">
//             <div className="font-bold text-white/95">Services</div>
//             <div className="flex flex-col gap-2 text-sm text-white/80">
//               <span>Water Tanker Delivery</span>
//               <span>RO Service</span>
//               <span>Plumbing</span>
//               <span>Borewell</span>
//               <span>Motor Repair</span>
//               <span>Tank Cleaning</span>
//             </div>
//           </div>

//           <div className="space-y-3">
//             <div className="font-bold text-white/95">Contact</div>
//             <div className="flex flex-col gap-2 text-sm text-white/80">
//               <div>📞 +91 9889305803</div>
//               <div>✉️ support.aurotap@gmail.com</div>
//               <div>📍 India</div>
//               <div>🕐 Mon–Sat 6AM–10PM</div>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="border-t border-white/10">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-white/80">
//           <div>© 2026 AuroWater. All rights reserved.</div>
//           <div className="flex items-center gap-4">
//             <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
//             <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
//           </div>
//         </div>
//       </div>
//     </footer>
//   );
// }







import Link from 'next/link';
import React from 'react';

/* ─────────────────────────────────────────────
   ICONS — all inline, no external deps
───────────────────────────────────────────── */
const IconWhatsApp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const IconInstagram = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5z"/>
    <circle cx="12" cy="12" r="4"/>
    <path d="M17.5 6.5h.01" strokeLinecap="round" strokeWidth="2.5"/>
  </svg>
);

const IconFacebook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v3H7v3h3v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1z"/>
  </svg>
);

const IconPhone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1.84h3a2 2 0 012 1.72c.13 1 .38 1.98.74 2.92a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.94.36 1.92.61 2.92.74A2 2 0 0122 16.92z"/>
  </svg>
);

const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
  </svg>
);

const IconPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
);

const IconArrow = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconDroplet = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="#60A5FA" fillOpacity="0.3"/>
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#60A5FA" strokeWidth="1.5" fill="none"/>
  </svg>
);

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'Home',        href: '/' },
  { label: 'Services',   href: '/services' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Pricing',    href: '/pricing' },
  { label: 'Technicians', href: '/technicians' },
  { label: 'About Us',   href: '/about' },
  { label: 'Contact',    href: '/contact' },
  { label: 'Dashboard',  href: '/dashboard' },
];

const SERVICE_LINKS = [
  { label: 'RO Water Can Delivery', href: '/book?service=water_can' },
  { label: 'Water Tanker Delivery', href: '/book?service=water_tanker' },
  { label: 'RO Service & Repair',   href: '/book?service=ro_service' },
  { label: 'Plumbing Services',     href: '/book?service=plumbing' },
  { label: 'Borewell Services',     href: '/book?service=borewell' },
  { label: 'Motor Pump Repair',     href: '/book?service=motor_pump' },
  { label: 'Water Tank Cleaning',   href: '/book?service=tank_cleaning' },
];

const CONTACT_ITEMS = [
  { icon: <IconPhone />, text: '+91 9889305803',          href: 'tel:+919889305803' },
  { icon: <IconMail />,  text: 'support.aurotap@gmail.com', href: 'mailto:support.aurotap@gmail.com' },
  { icon: <IconPin />,   text: 'Kanpur, Uttar Pradesh',   href: null },
  { icon: <IconClock />, text: 'Mon–Sat, 6AM–10PM IST',  href: null },
];

const SOCIAL = [
  { icon: <IconWhatsApp />,  href: 'https://wa.me/919889305803', label: 'WhatsApp', color: '#25D366' },
  { icon: <IconInstagram />, href: 'https://instagram.com',      label: 'Instagram', color: '#E1306C' },
  { icon: <IconFacebook />,  href: 'https://facebook.com',       label: 'Facebook',  color: '#1877F2' },
];

const TRUST_BADGES = [
  { value: '3,200+', label: 'Jobs done' },
  { value: '4.8★',   label: 'Avg rating' },
  { value: '13',     label: 'Cities' },
];

/* ─────────────────────────────────────────────
   FOOTER COMPONENT
───────────────────────────────────────────── */
export default function Footer() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .ft-root {
          font-family: 'DM Sans', sans-serif;
          background: #08111F;
          position: relative;
          overflow: hidden;
        }

        /* ── Animated background grid ── */
        .ft-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(96,165,250,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(96,165,250,0.04) 1px, transparent 1px);
          background-size: 52px 52px;
        }

        /* ── Glow orbs ── */
        .ft-orb {
          position: absolute; border-radius: 50%; pointer-events: none;
          animation: ftOrbDrift 10s ease-in-out infinite;
        }
        @keyframes ftOrbDrift {
          0%, 100% { transform: translate(0, 0); }
          50%       { transform: translate(20px, -15px); }
        }

        /* ── Wave top divider ── */
        .ft-wave-top { display: block; width: 100%; line-height: 0; }

        /* ── CTA band ── */
        .ft-cta-band {
          position: relative; z-index: 2;
          margin: 0 24px;
          background: linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #2563EB 100%);
          border-radius: 22px;
          padding: 36px 44px;
          display: flex; align-items: center; justify-content: space-between; gap: 24px;
          flex-wrap: wrap;
          box-shadow: 0 16px 56px rgba(37,99,235,0.28);
          overflow: hidden;
          margin-top: -28px;
        }
        .ft-cta-band::before {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(45deg, transparent, transparent 24px, rgba(255,255,255,0.025) 24px, rgba(255,255,255,0.025) 48px);
          pointer-events: none;
        }
        .ft-cta-band-orb {
          position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%);
        }
        .ft-cta-left { position: relative; z-index: 1; }
        .ft-cta-eyebrow {
          font-size: 10px; font-weight: 800; letter-spacing: 0.12em;
          text-transform: uppercase; color: #93C5FD; margin-bottom: 6px;
        }
        .ft-cta-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: clamp(1.2rem, 2.5vw, 1.7rem);
          color: #fff; letter-spacing: -0.8px; line-height: 1.1; margin: 0;
        }
        .ft-cta-title span { color: #BAE6FD; }
        .ft-cta-btns { display: flex; gap: 10px; flex-wrap: wrap; position: relative; z-index: 1; flex-shrink: 0; }
        .ft-cta-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 22px; border-radius: 12px;
          background: #fff; color: #1D4ED8;
          font-family: 'DM Sans', sans-serif; font-weight: 800; font-size: 13px;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
          transition: transform 0.18s, box-shadow 0.18s;
          white-space: nowrap; letter-spacing: -0.1px;
        }
        .ft-cta-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
        .ft-cta-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 20px; border-radius: 12px;
          background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.2);
          font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 13px;
          text-decoration: none; transition: background 0.18s, transform 0.18s;
          white-space: nowrap;
        }
        .ft-cta-btn-secondary:hover { background: rgba(255,255,255,0.18); transform: translateY(-2px); }

        /* ── Main body ── */
        .ft-body {
          position: relative; z-index: 2;
          max-width: 1160px; margin: 0 auto;
          padding: 60px 24px 48px;
        }

        .ft-main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1.3fr 1.3fr;
          gap: 48px;
        }

        /* Brand col */
        .ft-brand-name {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 14px;
        }
        .ft-brand-wordmark {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: 1.35rem; color: #fff; letter-spacing: -0.5px;
        }
        .ft-brand-desc {
          font-size: 13.5px; color: rgba(255,255,255,0.45);
          line-height: 1.65; margin-bottom: 20px; max-width: 260px;
        }

        /* Trust badges */
        .ft-trust-badges {
          display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px;
        }
        .ft-trust-badge {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 7px 12px; text-align: center;
          min-width: 64px;
        }
        .ft-trust-badge-val {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: 14px; color: #60A5FA; letter-spacing: -0.3px; line-height: 1;
        }
        .ft-trust-badge-lbl {
          font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.35);
          text-transform: uppercase; letter-spacing: 0.07em; margin-top: 2px;
        }

        /* Social icons */
        .ft-socials { display: flex; gap: 8px; }
        .ft-social-btn {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.6); text-decoration: none;
          transition: all 0.2s;
        }
        .ft-social-btn:hover { transform: translateY(-2px); }

        /* Column headings */
        .ft-col-head {
          font-family: 'Syne', sans-serif; font-weight: 800;
          font-size: 11px; color: rgba(255,255,255,0.9);
          letter-spacing: 0.1em; text-transform: uppercase;
          margin-bottom: 16px; padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        /* Nav links */
        .ft-link-list { display: flex; flex-direction: column; gap: 9px; }
        .ft-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: rgba(255,255,255,0.45);
          text-decoration: none; font-weight: 500;
          transition: color 0.15s; width: fit-content;
        }
        .ft-link:hover { color: #60A5FA; }
        .ft-link:hover .ft-link-arrow { opacity: 1; transform: translateX(2px); }
        .ft-link-arrow {
          opacity: 0; transition: opacity 0.15s, transform 0.15s;
          color: #60A5FA; flex-shrink: 0;
        }

        /* Contact items */
        .ft-contact-list { display: flex; flex-direction: column; gap: 11px; }
        .ft-contact-item {
          display: flex; align-items: flex-start; gap: 9px;
          font-size: 13px; color: rgba(255,255,255,0.45);
          font-weight: 500; text-decoration: none;
          transition: color 0.15s; line-height: 1.4;
        }
        .ft-contact-item:hover { color: rgba(255,255,255,0.75); }
        .ft-contact-icon {
          width: 26px; height: 26px; border-radius: 7px;
          background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.18);
          display: flex; align-items: center; justify-content: center;
          color: #60A5FA; flex-shrink: 0; margin-top: 1px;
        }

        /* ── Divider ── */
        .ft-divider {
          height: 1px; max-width: 1160px; margin: 0 auto;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent);
        }

        /* ── Bottom bar ── */
        .ft-bottom {
          position: relative; z-index: 2;
          max-width: 1160px; margin: 0 auto;
          padding: 20px 24px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .ft-bottom-copy {
          font-size: 12px; color: rgba(255,255,255,0.3); font-weight: 500;
        }
        .ft-bottom-links { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
        .ft-bottom-link {
          font-size: 12px; color: rgba(255,255,255,0.3); font-weight: 500;
          text-decoration: none; transition: color 0.15s;
        }
        .ft-bottom-link:hover { color: rgba(255,255,255,0.65); }
        .ft-bottom-sep {
          width: 3px; height: 3px; border-radius: 50%;
          background: rgba(255,255,255,0.15);
        }
        .ft-made-with {
          font-size: 12px; color: rgba(255,255,255,0.25); font-weight: 500;
        }
        .ft-made-with span { color: #60A5FA; }

        /* ── RESPONSIVE ── */
        @media (max-width: 960px) {
          .ft-main-grid { grid-template-columns: 1fr 1fr; gap: 36px; }
          .ft-cta-band { margin: -24px 16px 0; padding: 28px 28px; }
        }
        @media (max-width: 640px) {
          .ft-main-grid { grid-template-columns: 1fr; gap: 28px; }
          .ft-body { padding: 44px 20px 36px; }
          .ft-cta-band { margin: -20px 12px 0; padding: 24px 22px; flex-direction: column; align-items: flex-start; }
          .ft-brand-desc { max-width: 100%; }
          .ft-bottom { flex-direction: column; align-items: flex-start; gap: 10px; }
        }
        @media (max-width: 400px) {
          .ft-cta-btns { flex-direction: column; width: 100%; }
          .ft-cta-btn-primary, .ft-cta-btn-secondary { width: 100%; justify-content: center; }
        }

        /* Smooth handoff from page body into dark footer — override with --footer-prev-bg on :root */
        .ft-footer-bridge {
          display: block;
          width: 100%;
        }
      `}</style>

      {/* Blends last section background into footer (set --footer-prev-bg per page when needed) */}
      <div
        className="ft-footer-bridge"
        aria-hidden="true"
        style={{
          height: 48,
          marginTop: -1,
          background: 'linear-gradient(180deg, var(--footer-prev-bg, #ffffff) 0%, #08111f 100%)',
        }}
      />

      <footer className="ft-root" aria-label="Site footer">

        {/* ── Background decoration ── */}
        <div className="ft-grid" />
        <div className="ft-orb" style={{ width: 360, height: 360, top: -100, left: -80, background: 'radial-gradient(circle, rgba(37,99,235,0.08), transparent 70%)' }} />
        <div className="ft-orb" style={{ width: 280, height: 280, bottom: 40, right: -60, background: 'radial-gradient(circle, rgba(14,165,233,0.07), transparent 70%)', animationDelay: '3s' }} />

        {/* ── Wave top ── */}
        <svg className="ft-wave-top" viewBox="0 0 1440 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <path fill="#08111F" d="M0,28 C240,52 480,4 720,28 C960,52 1200,8 1440,28 L1440,56 L0,56 Z"/>
        </svg>

        {/* ── CTA band ── */}
        <div className="ft-cta-band">
          <div className="ft-cta-band-orb" style={{ width: 200, height: 200, top: -60, right: -40 }} />
          <div className="ft-cta-band-orb" style={{ width: 120, height: 120, bottom: -40, left: 80, animationDelay: '2s' }} />

          <div className="ft-cta-left">
            <div className="ft-cta-eyebrow">Ready when you are</div>
            <h2 className="ft-cta-title">
              Clean water, reliable service —<br/>
              <span>book in under 60 seconds.</span>
            </h2>
          </div>

          <div className="ft-cta-btns">
            <Link href="/book" className="ft-cta-btn-primary">
              <IconDroplet />
              Book a Service
              <IconArrow />
            </Link>
            <Link href="/contact?subject=technician" className="ft-cta-btn-secondary">
              Join as Technician
            </Link>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="ft-body">
          <div className="ft-main-grid">

            {/* Brand column */}
            <div>
              <div className="ft-brand-name">
                <img
                  src="/splash-logo.svg"
                  alt=""
                  width={52}
                  height={52}
                  className="shrink-0 rounded-2xl shadow-lg"
                  decoding="async"
                />
                <span className="ft-brand-wordmark">AuroWater</span>
              </div>
              <p className="ft-brand-desc">
                India's most transparent water service platform. Pure water cans, verified technicians, and reliable scheduling — across 13 UP cities.
              </p>

              {/* Trust badges */}
              <div className="ft-trust-badges">
                {TRUST_BADGES.map((b) => (
                  <div key={b.label} className="ft-trust-badge">
                    <div className="ft-trust-badge-val">{b.value}</div>
                    <div className="ft-trust-badge-lbl">{b.label}</div>
                  </div>
                ))}
              </div>

              {/* Socials */}
              <div className="ft-socials">
                {SOCIAL.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="ft-social-btn"
                    style={{ ['--hover-color' as string]: s.color }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = s.color + '22'; (e.currentTarget as HTMLAnchorElement).style.borderColor = s.color + '55'; (e.currentTarget as HTMLAnchorElement).style.color = s.color; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ''; (e.currentTarget as HTMLAnchorElement).style.borderColor = ''; (e.currentTarget as HTMLAnchorElement).style.color = ''; }}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <div className="ft-col-head">Navigation</div>
              <div className="ft-link-list">
                {NAV_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="ft-link">
                    {l.label}
                    <span className="ft-link-arrow"><IconArrow /></span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Services */}
            <div>
              <div className="ft-col-head">Our Services</div>
              <div className="ft-link-list">
                {SERVICE_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="ft-link">
                    {l.label}
                    <span className="ft-link-arrow"><IconArrow /></span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <div className="ft-col-head">Get in Touch</div>
              <div className="ft-contact-list">
                {CONTACT_ITEMS.map((item, i) =>
                  item.href ? (
                    <a key={i} href={item.href} className="ft-contact-item">
                      <div className="ft-contact-icon">{item.icon}</div>
                      <span>{item.text}</span>
                    </a>
                  ) : (
                    <div key={i} className="ft-contact-item">
                      <div className="ft-contact-icon">{item.icon}</div>
                      <span>{item.text}</span>
                    </div>
                  )
                )}
              </div>

              {/* WhatsApp CTA */}
              <a
                href="https://wa.me/919889305803"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  marginTop: 20, padding: '10px 16px', borderRadius: 11,
                  background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)',
                  color: '#4ADE80', fontWeight: 700, fontSize: 13,
                  textDecoration: 'none', transition: 'all 0.18s',
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.18)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.1)'; }}
              >
                <IconWhatsApp />
                Chat on WhatsApp
              </a>
            </div>

          </div>
        </div>

        {/* ── Divider ── */}
        <div className="ft-divider" />

        {/* ── Bottom bar ── */}
        <div className="ft-bottom">
          <div className="ft-bottom-copy">
            © {new Date().getFullYear()} AuroWater. All rights reserved.
          </div>

          <div className="ft-bottom-links">
            <Link href="/privacy" className="ft-bottom-link">Privacy Policy</Link>
            <span className="ft-bottom-sep" />
            <Link href="/terms" className="ft-bottom-link">Terms of Service</Link>
            <span className="ft-bottom-sep" />
            <Link href="/sitemap" className="ft-bottom-link">Sitemap</Link>
          </div>

          <div className="ft-made-with">
            Built for <span>India</span> 🇮🇳
          </div>
        </div>

      </footer>
    </>
  );
}