'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  onFinish?: () => void;
  duration?: number; // Milliseconds (e.g., 2000ms = 2 seconds)
}

export default function SplashScreen({ onFinish, duration = 2000 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true);
      const fadeTimer = setTimeout(() => {
        setIsVisible(false);
        if (onFinish) onFinish();
      }, 500); // Smooth exit transition duration
      return () => clearTimeout(fadeTimer);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between py-16 px-6 bg-gradient-to-b from-white via-slate-50 to-sky-50/50 text-slate-900 transition-opacity duration-500 ${
        isFading ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Top spacing element for centering */}
      <div className="w-full"></div>

      {/* Center Hero Section with Ripple Animations */}
      <div className="relative flex flex-col items-center">
        {/* Subtle Expanding Ripple Rings (Screen 4 style) */}
        <div className="absolute w-36 h-36 border border-sky-400/20 rounded-full animate-ping [animation-duration:2.5s]"></div>
        <div className="absolute w-48 h-48 border border-blue-500/10 rounded-full animate-ping [animation-duration:3.5s]"></div>
        <div className="absolute w-60 h-60 border border-sky-300/10 rounded-full animate-ping [animation-duration:4.5s]"></div>

        {/* Central White Circular Container with Soft Depth Shadow */}
        <div className="relative w-28 h-28 bg-white rounded-full shadow-[0_15px_35px_rgba(14,165,233,0.15)] border border-sky-100/80 flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
          {/* Water Drop Icon (You can replace this with <Image src="/logo.png" width={56} height={56} alt="Logo" /> if you have a square/round logo file) */}
          <svg
            className="w-12 h-12 text-sky-500 drop-shadow-[0_4px_8px_rgba(14,165,233,0.3)] animate-pulse"
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"></path>
          </svg>
        </div>

        {/* Brand Typography */}
        <div className="text-center mt-8 space-y-1.5">
          <h1 className="text-3xl font-black tracking-wider text-slate-900 drop-shadow-sm">
            AuroWater
          </h1>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sky-600/90">
            Pure Water, Delivered Smartly.
          </p>
        </div>
      </div>

      {/* Bottom Loading Indicator (Minimalist Spinner & Shimmer) */}
      <div className="flex flex-col items-center space-y-4 w-full">
        <div className="w-32 h-1 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-sky-500 rounded-full animate-[progress_1.8s_ease-in-out_infinite]"></div>
        </div>
        <span className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">
          Loading Experience...
        </span>
      </div>
    </div>
  );
}
