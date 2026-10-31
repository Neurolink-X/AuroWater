'use client';

import { useEffect } from 'react';

export type ScrollRevealOptions = {
  /** The fraction of an element visible before revealing it. */
  threshold?: number;
  /** Begin observing just before an element enters the viewport. */
  rootMargin?: string;
  /** Reveal only once, or replay the animation on re-entry. */
  once?: boolean;
  /** Compatible with existing data-reveal and fade-up markup. */
  selector?: string;
};

/**
 * Lightweight, progressive scroll reveals.
 *
 * Do not create a document-wide MutationObserver on coarse-pointer or
 * reduced-motion devices. Both groups get visible content immediately.
 *
 * Reveal animations must never block reading, native scrolling, keyboard
 * navigation, or clicks. The root data attribute is only added when
 * IntersectionObserver is operational, so unobserved content stays visible.
 */
export function useScrollAnimation({
  threshold = 0,
  rootMargin = '0px 0px -10% 0px',
  once = true,
  selector = '[data-reveal], .fade-up',
}: ScrollRevealOptions = {}) {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    // A literal "\\n" in the previous comment accidentally commented out
    // this guard. Keeping the condition executable avoids mobile scroll jank.
    if (reducedMotion || coarsePointer ||
        !('IntersectionObserver' in window)) {
      root.removeAttribute('data-reveal-ready');
      return;
    }

    const registered = new WeakSet<Element>();
    const observed = new Set<Element>();
    let frame = 0;
    let disconnected = false;
    const pending = new Set<Element>();

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          element.dataset.revealed = 'true';
          element.classList.add('visible');
          if (once) {
            observer.unobserve(element);
            observed.delete(element);
          }
        } else if (!once) {
          delete element.dataset.revealed;
          element.classList.remove('visible');
        }
      }
    }, { threshold, rootMargin });

    const register = (element: Element) => {
      if (!element.isConnected || registered.has(element)) return;
      registered.add(element);
      observed.add(element);
      observer.observe(element);
    };

    const observeIn = (container: ParentNode) => {
      if (container instanceof Element && container.matches(selector)) {
        register(container);
      }
      container.querySelectorAll(selector).forEach(register);
    };

    const staggerWithin = (container: ParentNode) => {
      const parents: HTMLElement[] = [];
      if (container instanceof HTMLElement && container.matches('[data-reveal-stagger]')) {
        parents.push(container);
      }
      container.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((parent) => {
        parents.push(parent);
      });
      for (const parent of parents) {
        const requested = Number(parent.dataset.revealStagger);
        const stagger = Number.isFinite(requested) ? Math.max(0, Math.min(120, requested)) : 70;
        parent.querySelectorAll<HTMLElement>(':scope > [data-reveal], :scope > .fade-up')
          .forEach((element, index) => {
            element.style.setProperty('--reveal-delay', `${Math.min(index * stagger, 420)}ms`);
          });
      }
    };

    // Initial scan happens once, not during scroll.
    staggerWithin(document);
    observeIn(document);
    root.setAttribute('data-reveal-ready', '');

    const flush = () => {
      frame = 0;
      if (disconnected) return;
      for (const node of pending) {
        if (!node.isConnected) continue;
        staggerWithin(node);
        observeIn(node);
      }
      pending.clear();
    };

    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) pending.add(node);
        }
        // Removed elements must not stay retained by the observer Set.
        for (const node of record.removedNodes) {
          if (!(node instanceof Element)) continue;
          for (const element of observed) {
            if (element === node || node.contains(element)) {
              observer.unobserve(element);
              observed.delete(element);
            }
          }
        }
      }
      if (pending.size && !frame) frame = requestAnimationFrame(flush);
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      disconnected = true;
      cancelAnimationFrame(frame);
      pending.clear();
      mutationObserver.disconnect();
      observer.disconnect();
      observed.clear();
      root.removeAttribute('data-reveal-ready');
    };
  }, [threshold, rootMargin, once, selector]);
}

export const useScrollReveal = useScrollAnimation;
