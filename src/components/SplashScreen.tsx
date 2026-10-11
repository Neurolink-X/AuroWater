'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  onFinish?: () => void;
  duration?: number; // Milliseconds
}

export default function SplashScreen({ onFinish, duration = 1800 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true);
      const fadeTimer = setTimeout(() => {
        setIsVisible(false);
        if (onFinish) onFinish();
      }, 400); // Match transition time
      return () => clearTimeout(fadeTimer);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900 text-white transition-opacity duration-400 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated Glowing Logo Container */}
      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute w-28 h-28 bg-white/20 rounded-full blur-xl animate-pulse"></div>
        <div className="relative bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/20 shadow-2xl flex items-center justify-center">
          {/* Water Drop / Brand Icon */}
          <svg
            className="w-16 h-16 text-white animate-bounce"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"
            ></path>
          </svg>
        </div>
      </div>

      {/* Brand Name & Tagline */}
      <h1 className="text-3xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-sky-100 to-blue-200">
        AuroTap
      </h1>
      <p className="text-sm font-medium text-sky-200/80 mt-1 tracking-wide">
        Pure Water, Delivered Smartly
      </p>

      {/* Sleek Loading Bar */}
      <div className="w-36 h-1 bg-white/20 rounded-full overflow-hidden mt-8">
        <div className="h-full bg-white rounded-full animate-[shimmer_1.5s_infinite]"></div>
      </div>
    </div>
  );
}
