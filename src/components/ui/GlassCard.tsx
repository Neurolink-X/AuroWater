'use client';

import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({
  children,
  className = '',
  hover = false,
}: GlassCardProps) {
  return (
    <div
      className={[
        'relative overflow-hidden',
        'rounded-2xl',
        'border border-slate-200/80',
        'bg-white/90 backdrop-blur-xl',
        'shadow-[0_8px_30px_rgba(15,23,42,0.06)]',
        'transition-all duration-200',
        hover
          ? [
              'hover:-translate-y-0.5',
              'hover:border-emerald-200',
              'hover:shadow-[0_14px_40px_rgba(16,185,129,0.10)]',
            ].join(' ')
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
