'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentProps, type MouseEvent } from 'react';

/**
 * Booking-entry link with immediate, accessible navigation feedback.
 *
 * Keep Next Link's native semantics (middle-click, long-press, modifier-click,
 * scroll restoration) instead of routing through an expensive custom handler.
 * Preserve each caller's Next Link prefetch policy. Default visible CTAs
 * retain Next's automatic prefetch; large lists that pass prefetch={false}
 * can still warm a bounded selection on pointer, focus or touch intent.
 */
type BookingIntentLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
};

const warmedLinks = new Set<string>();
const MAX_WARMED_BOOKING_ROUTES = 8;

export default function BookingIntentLink({
  href, children, className, onClick, onPointerEnter, onTouchStart, onFocus,
  prefetch, ...rest
}: BookingIntentLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Derive pending from the originating path. A successful route change clears
  // the indicator immediately without setState inside an effect.
  const [openingFrom, setOpeningFrom] = useState<string | null>(null);
  const opening = openingFrom === pathname;
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetRef.current) clearTimeout(resetRef.current);
  }, []);

  const warm = () => {
    if (!href.startsWith('/book') || warmedLinks.has(href) ||
        warmedLinks.size >= MAX_WARMED_BOOKING_ROUTES) return;
    warmedLinks.add(href);
    // Next prefetch is best-effort; a failed speculative fetch must never
    // block an actual click or trigger a booking API mutation.
    try { router.prefetch(href); } catch { /* native Link navigation remains */ }
  };

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.altKey || event.shiftKey ||
        event.currentTarget.target === '_blank') return;
    setOpeningFrom(pathname);
    if (resetRef.current) clearTimeout(resetRef.current);
    // In case a navigation is blocked by a browser extension or network error,
    // do not leave a permanently spinning CTA. Never auto-retry/order-submit.
    resetRef.current = setTimeout(() => setOpeningFrom(null), 8000);
  };

  return (
    <Link
      {...rest}
      href={href}
      prefetch={prefetch}
      className={className}
      onPointerEnter={event => { onPointerEnter?.(event); warm(); }}
      onTouchStart={event => { onTouchStart?.(event); warm(); }}
      onFocus={event => { onFocus?.(event); warm(); }}
      onClick={handleClick}
      aria-busy={opening}
    >
      {children}
      {opening && (
        <span className="ml-2 inline-flex shrink-0 items-center gap-1.5 text-xs font-bold" role="status" aria-live="polite">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
          Opening…
        </span>
      )}
    </Link>
  );
}
