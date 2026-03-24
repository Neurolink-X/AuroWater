'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white/80 shadow-card backdrop-blur-sm p-6 ${className}`}
    >
      {children}
    </div>
  );
}
