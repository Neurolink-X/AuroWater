'use client';

import { useEffect } from 'react';

/**
 * SplashController
 *
 * The splash itself is plain HTML + CSS in app/layout.tsx. This component only
 * decides WHEN to hide it:
 *
 *   hide at = the later of
 *       (a) app is hydrated and fonts are ready, and
 *       (b) MIN_SPLASH_MS since the page started loading
 *   but never later than MAX_SPLASH_MS.
 *
 * Keep the minimum brief and cap the wait aggressively: the splash is branding,
 * not a loading screen, and must not delay the user's first interaction.
 * A slow phone must never be blocked by an animation.
 * (CSS also hides the splash by itself at ~2.6s if JavaScript never runs.)
 *
 * Service worker registration is NOT done here. It stays in
 * components/pwa/ServiceWorkerRegistration.tsx, so it is registered only once.
 */

const MIN_SPLASH_MS = 180;
const MAX_SPLASH_MS = 800;

export default function SplashController() {
  useEffect(() => {
    const root = document.documentElement;

    // Nothing to do: splash was skipped (reload, bot, browser tab, etc.)
    if (root.dataset.splash !== 'show') return;

    let cancelled = false;

    const hide = () => {
      if (cancelled) return;
      root.dataset.splash = 'done';
    };

    // performance.now() = milliseconds since this page started loading.
    // On a fast phone most of MIN_SPLASH_MS is already used up.
    const minWait = Math.max(0, MIN_SPLASH_MS - performance.now());

    const minTimer = new Promise<void>((resolve) =>
      window.setTimeout(resolve, minWait),
    );

    const fontsReady: Promise<unknown> =
      document.fonts?.ready ?? Promise.resolve();

    void Promise.all([minTimer, fontsReady]).then(hide);

    // Safety net: whatever happens, hide by MAX_SPLASH_MS.
    const maxTimer = window.setTimeout(hide, MAX_SPLASH_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(maxTimer);
    };
  }, []);

  return null;
}
