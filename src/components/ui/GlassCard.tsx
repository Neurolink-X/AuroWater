'use client';

import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export default function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <div
      className={`rounded-xl border border-white/20 bg-white/70 backdrop-blur-md shadow-lg shadow-slate-200/50 ${className}`}
    >
      {children}
    </div>
  );
}
