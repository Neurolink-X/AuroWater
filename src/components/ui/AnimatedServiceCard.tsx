'use client';

import React from 'react';
import { Check, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';

const GlassCard: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ className = '', children }) => {
  return (
    <div
      className={[
        'rounded-2xl border border-slate-200/80',
        'bg-white/90 backdrop-blur-xl',
        'shadow-[0_8px_30px_rgba(15,23,42,0.06)]',
        'transition-all duration-200',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};

type Service = {
  id: number;
  name: string;
  description?: string;
  base_price?: number;
};

export default function AnimatedServiceCard({
  service,
  onSelect,
  selected = false,
}: {
  service: Service;
  onSelect?: (id: number) => void;
  selected?: boolean;
}) {
  const price =
    typeof service.base_price === 'number'
      ? `₹${service.base_price.toLocaleString('en-IN')}`
      : 'Price on request';

  const handleSelect = () => {
    onSelect?.(service.id);
  };

  return (
    <GlassCard
      className={[
        'group relative overflow-hidden',
        selected
          ? 'border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/50'
          : 'hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_40px_rgba(16,185,129,0.10)]',
      ].join(' ')}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
          <Check size={16} strokeWidth={2.5} />
        </div>
      )}

      <button
        type="button"
        onClick={handleSelect}
        aria-pressed={selected}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 pr-8">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  selected
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-600',
                ].join(' ')}
              >
                <Sparkles size={17} />
              </span>

              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-bold text-slate-900">
                  {service.name}
                </h3>

                <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <ShieldCheck size={12} />
                  Trusted service
                </div>
              </div>
            </div>

            <p className="line-clamp-2 text-xs leading-5 text-slate-500">
              {service.description || 'Professional service delivered at your doorstep.'}
            </p>
          </div>

          {/* Price */}
          <div className="shrink-0 text-right">
            <div className="text-lg font-extrabold tracking-tight text-slate-900">
              {price}
            </div>

            {typeof service.base_price === 'number' && (
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Starting price
              </div>
            )}
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
          <span className="text-[11px] font-medium text-slate-500">
            ✓ Fast booking
          </span>

          <span className="text-[11px] font-medium text-slate-500">
            ✓ Verified professionals
          </span>

          <span className="text-[11px] font-medium text-slate-500">
            ✓ Doorstep service
          </span>
        </div>

        {/* CTA */}
        <div className="mt-4 flex items-center justify-between">
          <span
            className={[
              'text-xs font-semibold',
              selected ? 'text-emerald-700' : 'text-slate-500',
            ].join(' ')}
          >
            {selected ? 'Service selected' : 'Choose this service'}
          </span>

          <span
            className={[
              'inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold transition-all',
              selected
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-white group-hover:bg-emerald-600',
            ].join(' ')}
          >
            {selected ? 'Selected' : 'Book now'}
            <ChevronRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </button>
    </GlassCard>
  );
}
