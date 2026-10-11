'use client';

import React, { useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  /** Called once, after the splash has fully left the screen. */
  onFinish?: () => void;
  /** Minimum time on screen in ms. (default 1600) */
  duration?: number;
  /** Hard cap in ms: the splash leaves even if the page is still loading. (default 4000) */
  maxWait?: number;
}

type Phase = 'show' | 'leaving' | 'gone';

const EXIT_MS = 500; // must match the CSS transition below

/*
 * How it decides whether to show
 * ------------------------------
 * layout.tsx runs a tiny boot script in <head> that sets <html data-splash="on">
 * before the first paint, only for real visitors (not search bots or speed
 * tests), once per browser session and on every launch of the installed app.
 * This component stays hidden (display: none) unless that attribute is present,
 * so there is no flash of content and nothing for crawlers to see.
 *
 * It leaves when ALL of these are true: the minimum duration passed, the page
 * finished loading, and fonts are ready. If something stalls, `maxWait` ends it.
 */
const CSS = `
.aw-splash{display:none;position:fixed;inset:0;z-index:2147483000;flex-direction:column;align-items:center;justify-content:space-between;padding:max(4rem,env(safe-area-inset-top)) 1.5rem max(4rem,env(safe-area-inset-bottom));background:linear-gradient(to bottom,#fff,#f8fafc 50%,rgba(240,249,255,.6));color:#0f172a;opacity:1;transform:scale(1);transition:opacity ${EXIT_MS}ms cubic-bezier(.4,0,.2,1),transform ${EXIT_MS}ms cubic-bezier(.4,0,.2,1)}
html[data-splash="on"] .aw-splash{display:flex}
.aw-splash.is-leaving{opacity:0;transform:scale(1.04);pointer-events:none}
.aw-splash-hero{display:flex;flex-direction:column;align-items:center}
.aw-splash-stage{position:relative;width:112px;height:112px}
.aw-ring{position:absolute;left:50%;top:50%;border-radius:50%;border:1px solid rgba(56,189,248,.35);opacity:0;animation:aw-ripple 3s cubic-bezier(.16,1,.3,1) infinite}
.aw-ring.r1{width:144px;height:144px}
.aw-ring.r2{width:192px;height:192px;border-color:rgba(59,130,246,.25);animation-delay:.6s}
.aw-ring.r3{width:240px;height:240px;border-color:rgba(125,211,252,.3);animation-delay:1.2s}
.aw-splash-badge{position:relative;display:grid;place-items:center;width:112px;height:112px;border-radius:50%;background:#fff;border:1px solid rgba(224,242,254,.9);box-shadow:0 15px 35px rgba(14,165,233,.15);animation:aw-pop .8s cubic-bezier(.16,1,.3,1) both}
.aw-splash-badge img{width:64px;height:64px;object-fit:contain;animation:aw-float 3s ease-in-out .8s infinite}
.aw-splash-text{margin-top:32px;text-align:center}
.aw-splash-name{font-family:var(--font-brand,system-ui),system-ui,sans-serif;font-weight:800;font-size:30px;line-height:1.1;letter-spacing:.04em;color:#0f172a;animation:aw-rise .7s cubic-bezier(.16,1,.3,1) .25s both}
.aw-splash-tag{margin-top:8px;font-size:11px;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:rgba(2,132,199,.9);animation:aw-rise .7s cubic-bezier(.16,1,.3,1) .4s both}
.aw-splash-foot{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%}
.aw-splash-track{width:128px;height:4px;border-radius:9999px;background:#e2e8f0;overflow:hidden}
.aw-splash-bar{width:100%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#0ea5e9);transform-origin:left;transform:scaleX(0);animation:aw-fill var(--aw-dur,1600ms) cubic-bezier(.22,1,.36,1) forwards}
.aw-splash.is-leaving .aw-splash-bar{animation:none;transform:scaleX(1);transition:transform .25s ease-out}
.aw-splash-label{font-size:10px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:#94a3b8}
@keyframes aw-ripple{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}
@keyframes aw-pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
@keyframes aw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes aw-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes aw-fill{from{transform:scaleX(0)}to{transform:scaleX(.92)}}
@media (prefers-reduced-motion:reduce){
.aw-splash,.aw-splash *{animation:none!important;transition:none!important}
.aw-splash-bar{transform:scaleX(.92)}
.aw-splash.is-leaving .aw-splash-bar{transform:scaleX(1)}
}
`;

export default function SplashScreen({
  onFinish,
  duration = 1600,
  maxWait = 4000,
}: SplashScreenProps) {
  const [phase, setPhase] = useState<Phase>('show');

  // Keep the latest callback without restarting the timers when the parent re-renders.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const root = document.documentElement;

    // Boot script said "don't show" (bot, already seen this session, web disabled).
    if (root.getAttribute('data-splash') !== 'on') {
      setPhase('gone');
      return;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minMs = reduce ? Math.min(duration, 600) : duration;

    // No scrolling behind the splash.
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    let cancelled = false;
    let finished = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const leave = () => {
      if (cancelled || finished) return;
      finished = true;
      setPhase('leaving');
      later(() => {
        root.style.overflow = prevOverflow;
        root.removeAttribute('data-splash');
        setPhase('gone');
        onFinishRef.current?.();
      }, reduce ? 0 : EXIT_MS);
    };

    const minElapsed = new Promise<void>((resolve) => later(resolve, minMs));
    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', () => resolve(), { once: true });
    });
    const fontsReady: Promise<unknown> = document.fonts?.ready ?? Promise.resolve();

    Promise.all([minElapsed, loaded, fontsReady]).then(leave);
    later(leave, maxWait);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      root.style.overflow = prevOverflow;
    };
  }, [duration, maxWait]);

  if (phase === 'gone') return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div
        className={`aw-splash${phase === 'leaving' ? ' is-leaving' : ''}`}
        style={{ '--aw-dur': `${duration}ms` } as React.CSSProperties}
        aria-hidden="true"
      >
        {/* Top spacer keeps the hero centred */}
        <div />

        {/* Hero: ripple rings, logo badge, brand. Plain divs (not h1) so the
            splash never competes with the real page heading for SEO. */}
        <div className="aw-splash-hero">
          <div className="aw-splash-stage">
            <span className="aw-ring r1" />
            <span className="aw-ring r2" />
            <span className="aw-ring r3" />

            <div className="aw-splash-badge">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/splash-logo.svg"
                alt=""
                width={64}
                height={64}
                decoding="async"
                fetchPriority="high"
              />
            </div>
          </div>

          <div className="aw-splash-text">
            <div className="aw-splash-name">AuroWater</div>
            <div className="aw-splash-tag">Pure Water, Delivered Smartly.</div>
          </div>
        </div>

        {/* Progress: fills over the minimum duration, completes when the app is ready */}
        <div className="aw-splash-foot">
          <div className="aw-splash-track">
            <div className="aw-splash-bar" />
          </div>
          <span className="aw-splash-label">Loading Experience...</span>
        </div>
      </div>
    </>
  );
}
