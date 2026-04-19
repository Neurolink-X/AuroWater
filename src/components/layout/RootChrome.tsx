// 'use client';

// import React from 'react';
// import { usePathname } from 'next/navigation';
// import SiteNav from '@/components/layout/SiteNav';
// import Footer from '@/components/layout/Footer';
// import WhatsAppFAB from '@/components/ui/WhatsAppFAB';

// export default function RootChrome({ children }: { children: React.ReactNode }) {
//   const pathname = usePathname();
//   const isAdmin = pathname?.startsWith('/admin');
//   const [barVisible, setBarVisible] = React.useState(false);

//   React.useEffect(() => {
//     try {
//       const dismissed = localStorage.getItem('aurowater_bar_dismissed') === '1';
//       setBarVisible(!dismissed);
//     } catch {
//       // If storage is unavailable, show the bar by default.
//       setBarVisible(true);
//     }
//   }, []);

//   if (isAdmin) {
//     // Admin area has its own shell; keep public nav/footer out.
//     return <main className="min-h-screen">{children}</main>;
//   }

//   return (
//     <>
//       <SiteNav offsetPx={barVisible ? 40 : 0} />
//       <main className="flex-1">
//         <div key={pathname} className="animate-scale-in">
//           {children}
//         </div>
//       </main>
//       <Footer />
//       <WhatsAppFAB />
//     </>
//   );
// }

'use client';

/**
 * AuroWater — RootChrome
 * Place at: src/components/layout/RootChrome.tsx
 *
 * Public-site shell: announcement bar → SiteNav → page content → Footer → WhatsApp FAB.
 * Admin/dashboard/auth routes opt out automatically.
 *
 * Features:
 *   • Announcement bar with localStorage dismiss + 7-day re-show
 *   • Smooth page transition (fade + slide) keyed on pathname
 *   • Sticky SiteNav with dynamic offsetPx to clear the bar
 *   • Reduced-motion support (prefers-reduced-motion)
 *   • Zero external animation libraries
 *   • All CSS scoped — no Tailwind conflicts
 */

import React from 'react';
import { usePathname } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import Footer from '@/components/layout/Footer';
import WhatsAppFAB from '@/components/ui/WhatsAppFAB';

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

/**
 * Routes whose prefix causes the public chrome (SiteNav / Footer / FAB)
 * to be suppressed — they render their own shell.
 */
const CHROME_EXCLUDE_PREFIXES = ['/admin', '/technician', '/supplier', '/auth'];

/** Primary key (aligned with announcement dismiss sync). Legacy key still read for migration. */
const BAR_KEY = 'aw_announcement_dismissed';
const BAR_LEGACY_KEY = 'aurowater_bar_dismissed';
const BAR_TS_KEY = 'aurowater_bar_ts';
const BAR_HIDE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BAR_HEIGHT = 40; // px — must match .rc-bar min-height in CSS

/* ─────────────────────────────────────────────
   ANNOUNCEMENT BAR DATA
   Edit this to change the live site banner.
───────────────────────────────────────────── */
const ANNOUNCEMENT = {
  emoji:   '💧',
  text:    'Free delivery on your first water can order!',
  cta:     'Book now →',
  ctaHref: '/book?service=water_can',
};

/* ─────────────────────────────────────────────
   ANNOUNCEMENT BAR
───────────────────────────────────────────── */
function AnnouncementBar({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <div className="rc-bar" role="banner" aria-label="Announcement">
      <a href={ANNOUNCEMENT.ctaHref} className="rc-bar-inner">
        <span className="rc-bar-emoji" aria-hidden="true">{ANNOUNCEMENT.emoji}</span>
        <span className="rc-bar-text">{ANNOUNCEMENT.text}</span>
        <span className="rc-bar-cta">{ANNOUNCEMENT.cta}</span>
      </a>
      <button
        type="button"
        aria-label="Dismiss announcement"
        className="rc-bar-close"
        onClick={e => { e.preventDefault(); onDismiss(); }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT CHROME
───────────────────────────────────────────── */
export default function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  /* ── Suppress chrome for non-public routes ── */
  const suppressChrome = CHROME_EXCLUDE_PREFIXES.some(
    prefix => pathname?.startsWith(prefix)
  );

  /* ── Announcement bar state ── */
  const [barVisible, setBarVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const dismissedNew = localStorage.getItem(BAR_KEY) === '1';
      const dismissedLegacy = localStorage.getItem(BAR_LEGACY_KEY) === '1';
      const dismissed = dismissedNew || dismissedLegacy;
      const ts = Number(localStorage.getItem(BAR_TS_KEY) ?? '0');
      const expired = Date.now() - ts > BAR_HIDE_MS;
      setBarVisible(!dismissed || expired);
    } catch {
      setBarVisible(true);
    }
  }, []);

  const dismissBar = React.useCallback(() => {
    setBarVisible(false);
    try {
      localStorage.setItem(BAR_KEY, '1');
      localStorage.setItem(BAR_LEGACY_KEY, '1');
      localStorage.setItem(BAR_TS_KEY, String(Date.now()));
    } catch {
      /* quota — silently ignore */
    }
    window.dispatchEvent(new CustomEvent('aw:announcement:dismissed'));
  }, []);

  /* ── Nav offset: clear the announcement bar when it's visible ── */
  const navOffset = barVisible ? BAR_HEIGHT : 0;

  /* ── Admin / dashboard / auth: render bare shell ── */
  if (suppressChrome) {
    return (
      <main
        className="rc-bare"
        style={{ minHeight: '100vh' }}
      >
        {children}
      </main>
    );
  }

  /* ── Public shell ── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

        /* ── Keyframes ── */
        @keyframes rcBarSlide   { from{transform:translateY(-100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes rcBarFadeOut { from{opacity:1;max-height:${BAR_HEIGHT}px} to{opacity:0;max-height:0} }
        @keyframes rcPageIn     { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

        @media(prefers-reduced-motion:reduce) {
          .rc-page-wrap  { animation:none !important; }
          .rc-bar        { animation:none !important; }
        }

        /* ── Announcement bar ── */
        .rc-bar {
          min-height:${BAR_HEIGHT}px;
          background:linear-gradient(90deg,#0A1628,#1E3A8A,#1D4ED8,#0891B2);
          background-size:300% 100%;
          animation:rcBarSlide 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
          display:flex; align-items:center; justify-content:center;
          padding:0 40px; position:relative; z-index:50;
          font-family:'DM Sans',sans-serif;
        }
        .rc-bar-inner {
          display:flex; align-items:center; gap:8px; text-decoration:none;
          overflow:hidden;
        }
        .rc-bar-emoji { font-size:14px; flex-shrink:0; }
        .rc-bar-text  {
          font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.85);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .rc-bar-cta   {
          font-size:11.5px; font-weight:800; color:#7DD3FC;
          white-space:nowrap; flex-shrink:0; margin-left:4px;
          text-decoration:underline; text-underline-offset:2px;
        }
        .rc-bar-close {
          position:absolute; right:12px; top:50%; transform:translateY(-50%);
          background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2);
          border-radius:99px; width:24px; height:24px;
          display:flex; align-items:center; justify-content:center;
          color:rgba(255,255,255,0.65); cursor:pointer;
          transition:all 0.15s;
        }
        .rc-bar-close:hover { background:rgba(255,255,255,0.2); color:#fff; }
        .rc-bar-close:focus-visible {
          outline:2px solid #7DD3FC; outline-offset:2px;
        }

        /* ── Page transition ── */
        .rc-page-wrap {
          flex:1; animation:rcPageIn 0.28s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* ── Layout ── */
        .rc-public { display:flex; flex-direction:column; min-height:100vh; }
        .rc-main   { flex:1; display:flex; flex-direction:column; }

        /* ── Responsive bar ── */
        @media(max-width:480px) {
          .rc-bar { padding:0 36px; }
          .rc-bar-text { font-size:11px; }
          .rc-bar-cta  { display:none; }
        }
      `}</style>

      <div className="rc-public">
        {/* Announcement bar */}
        {barVisible && <AnnouncementBar onDismiss={dismissBar} />}

        {/* Navigation */}
        <SiteNav offsetPx={navOffset} />

        {/* Page content with transition */}
        <main className="rc-main">
          <div key={pathname} className="rc-page-wrap">
            {children}
          </div>
        </main>

        {/* Footer */}
        <Footer />

        {/* WhatsApp FAB */}
        <WhatsAppFAB />
      </div>
    </>
  );
}