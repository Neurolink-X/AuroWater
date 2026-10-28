'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSettings, buildWhatsappHref } from '@/hooks/useSettings';

/**
 * Floating WhatsApp help button.
 *
 * - Same behaviour as before (settings-driven, hidden when WhatsApp is off).
 * - Opens WhatsApp with a message that matches the page the customer is on.
 * - Shows "Online now" / "Back at 9:00 AM" from the admin-editable working hours.
 * - Lifts above the booking page's fixed bottom bar.
 * - Moves out of the way: hides while scrolling down on phones and while a form
 *   field is focused (on-screen keyboard), and comes back on scroll up.
 * - Respects reduced motion, safe areas and printing.
 */

const DEFAULT_MESSAGE = 'Hi AuroWater, I need help with my booking/service.';

const humanize = (slug: string) =>
  slug.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

/** A short message that tells support what the customer was looking at. */
function messageFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/book' || path.startsWith('/book/')) return 'Hi AuroWater, I need help with my booking.';
  if (path === '/pricing') return 'Hi AuroWater, I have a question about your pricing.';
  if (path === '/contact') return 'Hi AuroWater, I would like to talk to your team.';
  const service = path.match(/^\/services\/([^/]+)$/);
  if (service) return `Hi AuroWater, I would like to know more about ${humanize(service[1])}.`;
  const city = path.match(/^\/water-delivery\/([^/]+)$/);
  if (city) return `Hi AuroWater, I need water can delivery in ${humanize(city[1])}.`;
  return DEFAULT_MESSAGE;
}

/** "09:00–21:00 IST" → minutes since midnight, or null when the text is not in that shape. */
function parseHours(text: string | undefined): { open: number; close: number } | null {
  const m = String(text ?? '').match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = Number(m[1]) * 60 + Number(m[2]);
  const close = Number(m[3]) * 60 + Number(m[4]);
  if (![open, close].every(Number.isFinite) || open >= 24 * 60 || close > 24 * 60 || open === close) return null;
  return { open, close };
}

const IST_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
});

function istMinutes(): number {
  const parts = IST_CLOCK.formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function to12h(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ap = h24 >= 12 ? 'PM' : 'AM';
  return `${h24 % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
}

/** Put the message in the ?text= parameter exactly once (the old code could add it twice). */
function withText(baseHref: string, message: string): string {
  try {
    const url = new URL(baseHref.includes('://') ? baseHref : `https://${baseHref}`);
    url.searchParams.set('text', message);
    return url.toString();
  } catch {
    const separator = baseHref.includes('?') ? '&' : '?';
    return `${baseHref}${separator}text=${encodeURIComponent(message)}`;
  }
}

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select') ||
    el.isContentEditable);

export default function WhatsAppFAB() {
  const { settings, whatsappHref } = useSettings();
  const pathname = usePathname() ?? '/';
  // The booking page has a fixed bottom bar (total + Continue); lift the button above it.
  const onBooking = pathname.startsWith('/book');

  const [minutes, setMinutes] = useState<number | null>(null);
  const [scrolledAway, setScrolledAway] = useState(false);
  const [typing, setTyping] = useState(false);

  const message = useMemo(() => messageFor(pathname), [pathname]);

  const href = useMemo(() => {
    if (!settings.whatsapp_enabled) return null;

    const baseHref = whatsappHref || buildWhatsappHref(settings.phone_primary, message);
    if (!baseHref) return null;

    return withText(baseHref, message);
  }, [settings.whatsapp_enabled, settings.phone_primary, whatsappHref, message]);

  /* Business-hours status (read on the client only, so server and browser HTML match) */
  useEffect(() => {
    const tick = () => setMinutes(istMinutes());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);

  /* Get out of the way: hide on scroll-down (phones) and while a field is focused */
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 639px)');
    let lastY = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const dy = y - lastY;
        if (!phone.matches) { setScrolledAway(false); lastY = y; return; }
        if (dy > 10 && y > 240) setScrolledAway(true);
        else if (dy < -10 || y < 120) setScrolledAway(false);
        if (Math.abs(dy) > 10) lastY = y;
      });
    };
    const onFocusIn = (e: FocusEvent) => { if (isTypingTarget(e.target)) setTyping(true); };
    const onFocusOut = () => setTyping(false);

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const status = useMemo(() => {
    const hours = parseHours(settings.working_hours);
    if (!hours || minutes === null) return null;
    const open = hours.open < hours.close
      ? minutes >= hours.open && minutes < hours.close
      : minutes >= hours.open || minutes < hours.close; // overnight window
    return { open, opensAt: to12h(hours.open) };
  }, [settings.working_hours, minutes]);

  const trackClick = useCallback(() => {
    try {
      (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'whatsapp_click', {
        page_path: pathname,
        business_open: status ? status.open : undefined,
      });
    } catch { /* analytics must never block the chat */ }
  }, [pathname, status]);

  if (!settings.whatsapp_enabled || !href) {
    return null;
  }

  const hidden = scrolledAway || typing;
  const label = status
    ? status.open ? 'Need help? · Online now' : `Need help? · Back at ${status.opensAt}`
    : 'Need help?';

  return (
    <div
      className={[
        'fixed right-[max(1rem,env(safe-area-inset-right))] z-[60] sm:right-6 print:hidden',
        'transition-all duration-300 ease-out motion-reduce:transition-none',
        onBooking
          ? 'bottom-[calc(6.25rem+env(safe-area-inset-bottom))] sm:bottom-24'
          : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6',
        hidden ? 'pointer-events-none translate-y-6 opacity-0' : 'translate-y-0 opacity-100',
      ].join(' ')}
      aria-hidden={hidden || undefined}
    >
      {/* Desktop / tablet helper label */}
      <div
        className="
          absolute
          right-0
          bottom-[calc(100%+10px)]
          hidden
          items-center
          gap-2
          whitespace-nowrap
          rounded-xl
          border
          border-slate-200
          bg-white
          px-3
          py-2
          text-xs
          font-semibold
          text-slate-700
          shadow-lg
          sm:flex
        "
      >
        {status && (
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${status.open ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
        )}
        {label}
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackClick}
        tabIndex={hidden ? -1 : undefined}
        aria-label={`Chat with AuroWater support on WhatsApp${status ? (status.open ? ' (online now)' : ` (back at ${status.opensAt})`) : ''}`}
        title="Chat with AuroWater support"
        className="
          group
          relative
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-full
          bg-gradient-to-br
          from-[#2BE073]
          to-[#1DB954]
          text-white
          shadow-[0_8px_30px_rgba(37,211,102,0.30),inset_0_1px_0_rgba(255,255,255,0.35)]
          ring-1
          ring-white/80
          transition
          duration-200
          hover:-translate-y-0.5
          hover:scale-[1.03]
          hover:shadow-[0_12px_35px_rgba(37,211,102,0.38),inset_0_1px_0_rgba(255,255,255,0.35)]
          active:scale-95
          motion-reduce:transition-none
          motion-reduce:hover:transform-none
          focus:outline-none
          focus-visible:ring-4
          focus-visible:ring-[#25D366]/40
          sm:h-15
          sm:w-15
        "
      >
        {/* Status indicator: green while the team is online, amber outside working hours */}
        <span
          aria-hidden="true"
          className={`absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
            status && !status.open ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        >
          {status?.open && (
            <span className="absolute inset-0 rounded-full bg-emerald-400/70 motion-safe:animate-ping" />
          )}
        </span>

        {/* WhatsApp icon */}
        <svg
          width="27"
          height="27"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
        >
          <path d="M20.52 3.48A11.87 11.87 0 0 0 12.05 0C5.49 0 .15 5.34.15 11.9c0 2.1.55 4.15 1.6 5.96L.05 24l6.28-1.65a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.43-8.43ZM12.06 21.84h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.73.98.99-3.64-.24-.37a9.88 9.88 0 0 1-1.52-5.32c0-5.47 4.45-9.92 9.92-9.92 2.65 0 5.14 1.03 7.02 2.91a9.86 9.86 0 0 1 2.9 7.02c0 5.48-4.45 9.93-9.94 9.93Zm5.44-7.43c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
        </svg>

        <span className="sr-only">
          Contact AuroWater support on WhatsApp
        </span>
      </a>
    </div>
  );
}



// 'use client';

// import React, { useMemo } from 'react';
// import { MessageCircle, X } from 'lucide-react';
// import { useSettings, buildWhatsappHref } from '@/hooks/useSettings';

// export default function WhatsAppFAB() {
//   const { settings, whatsappHref } = useSettings();

//   const href = useMemo(() => {
//     if (!settings.whatsapp_enabled) return null;

//     const message =
//       'Hi AuroWater, I need help with my booking/service.';

//     const baseHref =
//       whatsappHref ||
//       buildWhatsappHref(settings.phone_primary, message);

//     if (!baseHref) return null;

//     const separator = baseHref.includes('?') ? '&' : '?';

//     return `${baseHref}${separator}text=${encodeURIComponent(message)}`;
//   }, [
//     settings.whatsapp_enabled,
//     settings.phone_primary,
//     whatsappHref,
//   ]);

//   if (!settings.whatsapp_enabled || !href) {
//     return null;
//   }

//   return (
//     <div
//       className="
//         fixed
//         bottom-[calc(1rem+env(safe-area-inset-bottom))]
//         right-4
//         z-[60]
//         sm:bottom-6
//         sm:right-6
//       "
//     >
//       {/* Desktop / tablet helper label */}
//       <div
//         className="
//           absolute
//           right-0
//           bottom-[calc(100%+10px)]
//           hidden
//           whitespace-nowrap
//           rounded-xl
//           border
//           border-slate-200
//           bg-white
//           px-3
//           py-2
//           text-xs
//           font-semibold
//           text-slate-700
//           shadow-lg
//           sm:block
//         "
//       >
//         Need help?
//       </div>

//       <a
//         href={href}
//         target="_blank"
//         rel="noopener noreferrer"
//         aria-label="Chat with AuroWater support on WhatsApp"
//         title="Chat with AuroWater support"
//         className="
//           group
//           relative
//           flex
//           h-14
//           w-14
//           items-center
//           justify-center
//           rounded-full
//           bg-[#25D366]
//           text-white
//           shadow-[0_8px_30px_rgba(37,211,102,0.30)]
//           ring-1
//           ring-white/80
//           transition
//           duration-200
//           hover:-translate-y-0.5
//           hover:scale-[1.03]
//           hover:shadow-[0_12px_35px_rgba(37,211,102,0.38)]
//           active:scale-95
//           focus:outline-none
//           focus-visible:ring-4
//           focus-visible:ring-[#25D366]/30
//           sm:h-15
//           sm:w-15
//         "
//       >
//         {/* Subtle status indicator */}
//         <span
//           aria-hidden="true"
//           className="
//             absolute
//             right-0
//             top-0
//             h-3.5
//             w-3.5
//             rounded-full
//             border-2
//             border-white
//             bg-emerald-500
//           "
//         />

//         {/* WhatsApp icon */}
//         <svg
//           width="27"
//           height="27"
//           viewBox="0 0 24 24"
//           fill="currentColor"
//           aria-hidden="true"
//           className="transition-transform duration-200 group-hover:scale-105"
//         >
//           <path d="M20.52 3.48A11.87 11.87 0 0 0 12.05 0C5.49 0 .15 5.34.15 11.9c0 2.1.55 4.15 1.6 5.96L.05 24l6.28-1.65a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.43-8.43ZM12.06 21.84h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.73.98.99-3.64-.24-.37a9.88 9.88 0 0 1-1.52-5.32c0-5.47 4.45-9.92 9.92-9.92 2.65 0 5.14 1.03 7.02 2.91a9.86 9.86 0 0 1 2.9 7.02c0 5.48-4.45 9.93-9.94 9.93Zm5.44-7.43c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
//         </svg>

//         <span className="sr-only">
//           Contact AuroWater support on WhatsApp
//         </span>
//       </a>
//     </div>
//   );
// }
