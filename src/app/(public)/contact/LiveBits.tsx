// PATH: src/app/(public)/contact/LiveBits.tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, MessageCircle, Send } from 'lucide-react';
import { supportStatus } from '@/lib/contact-shared';
import { trackEvent } from './track';

/** Anchor that reports clicks (call / WhatsApp / email) to analytics. Renders as a normal link without JS. */
export function TrackedLink({ href, event, className, children, external, ariaLabel }: {
  href: string; event: string; className?: string; children: ReactNode; external?: boolean; ariaLabel?: string;
}) {
  return (
    <a href={href} aria-label={ariaLabel} className={className} onClick={() => trackEvent(event, { href })}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

/** Computed in the browser (IST) so the statically cached page never shows a stale "online" state. */
export function OpenNowBadge({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<ReturnType<typeof supportStatus> | null>(null);
  useEffect(() => {
    const tick = () => setStatus(supportStatus());
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  if (!status) return <span className={`inline-block h-7 w-44 rounded-full bg-white/10 ${className}`} aria-hidden="true" />;
  return (
    <span role="status" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
      status.open ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-amber-300/40 bg-amber-400/10 text-amber-100'
    } ${className}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${status.open ? 'bg-emerald-300' : 'bg-amber-300'}`} />
      {status.label}
    </span>
  );
}

/**
 * Booking-first mobile bar: direct service discovery and messaging.
 * Hide while footer is visible to keep footer links usable.
 */
export function MobileActionBar({ whatsappLink }: { whatsappLink: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { threshold: 0.05 });
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  const btn = 'flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  return (
    <div aria-label="Booking and messaging shortcuts" className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur transition-transform duration-200 md:hidden ${hidden ? 'translate-y-full pointer-events-none' : ''}`}
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-md gap-2">
        <a href="/book" className={`${btn} bg-emerald-700 text-white focus-visible:outline-emerald-700`}>
          Book now <ArrowRight size={16} aria-hidden="true" />
        </a>
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('contact_whatsapp_click', { placement: 'mobile_bar' })} className={`${btn} bg-[#25D366] text-slate-950 focus-visible:outline-emerald-700`}>
          <MessageCircle size={17} aria-hidden="true" /> WhatsApp
        </a>
        <a href="#contact-form" className={`${btn} border border-slate-300 text-slate-800 focus-visible:outline-slate-500`}>
          <Send size={16} aria-hidden="true" /> Enquiry
        </a>
      </div>
    </div>
  );
}
