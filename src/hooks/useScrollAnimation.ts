'use client';

import { useEffect, useLayoutEffect } from 'react';

// useLayoutEffect on the client avoids a flash of visible content before hiding;
// useEffect on the server avoids the SSR warning.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type ScrollRevealOptions = {
  /** Fraction of the element that must be visible. 0 is safest for tall elements. */
  threshold?: number;
  /** Trigger slightly before the element is fully in view. */
  rootMargin?: string;
  /** true = animate once. false = replay when scrolling back past. */
  once?: boolean;
  /** Elements to animate. `.fade-up` is kept so existing markup keeps working. */
  selector?: string;
};

export function useScrollAnimation({
  threshold = 0,
  rootMargin = '0px 0px -10% 0px',
  once = true,
  selector = '[data-reveal], .fade-up',
}: ScrollRevealOptions = {}) {
  useIsoLayoutEffect(() => {
    const html = document.documentElement;

    // Respect reduced motion and old browsers: never hide anything.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    const registered = new WeakSet<Element>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            el.setAttribute('data-revealed', '');
            el.classList.add('visible'); // backwards compatible with old CSS
            if (once) io.unobserve(el);
          } else if (!once) {
            el.removeAttribute('data-revealed');
            el.classList.remove('visible');
          }
        }
      },
      { threshold, rootMargin }
    );

    const register = () => {
      // Stagger: <ul data-reveal-stagger="80"> sets a delay on each direct [data-reveal] child.
      document.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((parent) => {
        const step = Number(parent.dataset.revealStagger) || 70;
        parent
          .querySelectorAll<HTMLElement>(':scope > [data-reveal], :scope > .fade-up')
          .forEach((child, i) => child.style.setProperty('--reveal-delay', `${i * step}ms`));
      });

      document.querySelectorAll(selector).forEach((el) => {
        if (registered.has(el)) return;
        registered.add(el);
        io.observe(el);
      });
    };

    register();
    html.setAttribute('data-reveal-ready', '');

    // Pick up content added later (route changes, lazy sections, CMS data).
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(register);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
      html.removeAttribute('data-reveal-ready');
    };
  }, [threshold, rootMargin, once, selector]);
}

/** Alias for the newer name. */
export const useScrollReveal = useScrollAnimation;
