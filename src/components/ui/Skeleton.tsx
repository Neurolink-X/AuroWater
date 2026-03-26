'use client';

import React from 'react';

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-slate-100 animate-pulse border border-slate-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ className = '' }: { className?: string }) {
  return <div className={`h-4 rounded-lg bg-slate-100 animate-pulse border border-slate-200/80 ${className}`} aria-hidden="true" />;
}

export function SkeletonAvatar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-full bg-slate-100 animate-pulse border border-slate-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

