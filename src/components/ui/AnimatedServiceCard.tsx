'use client';
import React from 'react';

const GlassCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = '', children }) => {
  return (
    <div className={`rounded-lg p-4 bg-white/5 backdrop-blur-sm shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export default function AnimatedServiceCard({
  service,
  onSelect,
  selected = false,
}: {
  service: { id: number; name: string; description?: string; base_price?: number };
  onSelect?: (id: number) => void;
  selected?: boolean;
}) {
  return (
    <GlassCard className={`transition-transform hover:scale-[1.02] active:scale-[0.99] cursor-pointer ${selected ? 'ring-2 ring-emerald-200 bg-emerald-50' : ''}`}>
      <div onClick={() => onSelect?.(service.id)} className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-emerald-700 font-semibold">{service.name}</div>
          <div className="text-xs text-slate-500 mt-1">{service.description}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-emerald-600">₹{service.base_price ?? '—'}</div>
          <div className="text-xs text-slate-400">starting</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">Fast booking • Trusted pros</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelect?.(service.id)}
            className="px-3 py-1 rounded-md bg-emerald-600 text-white text-sm shadow-sm hover:brightness-105"
          >
            {selected ? 'Selected' : 'Book'}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}