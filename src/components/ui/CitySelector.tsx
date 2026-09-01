'use client';

import { useEffect, useRef, useState } from 'react';
import type { City } from '@/lib/cities';
import { FALLBACK_CITIES } from '@/lib/cities';
import { safeSessionGet, safeSessionSet } from '@/lib/storage';

export type { City };

type Props = {
  value: string | null;
  onChange: (cityId: string | null, cityName: string, isActive: boolean) => void;
  className?: string;
};

const STATUS_CONFIG = {
  active: { label: 'Available', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  coming_soon: { label: 'Coming soon', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  waitlist: { label: 'Join waitlist', color: 'text-neutral-400', dot: 'bg-neutral-500' },
} as const;

const CACHE_KEY = 'aw_cities';
const CACHE_TTL = 5 * 60 * 1000;

export default function CitySelector({ value, onChange, className }: Props) {
  const [cities, setCities] = useState<City[]>(FALLBACK_CITIES);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customMode, setCustomMode] = useState(false);
  const [customCity, setCustomCity] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const raw = safeSessionGet(CACHE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { data?: City[]; ts?: number };
        if (parsed.data && Date.now() - (parsed.ts ?? 0) < CACHE_TTL) {
          setCities(parsed.data);
          setLoading(false);
          return;
        }
      } catch {
        /* ignore */
      }
    }

    void fetch('/api/cities')
      .then(async (r) => (r.ok ? ((await r.json()) as City[]) : FALLBACK_CITIES))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setCities(data);
        safeSessionSet(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      })
      .catch(() => {
        if (!cancelled) setCities(FALLBACK_CITIES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = cities.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const featured = filtered.filter((c) => c.is_featured);
  const others = filtered.filter((c) => !c.is_featured);
  const selected = cities.find((c) => c.id === value);

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-[#0d1f35] px-4 py-3 text-left ${
          open ? 'border-cyan-500/50' : 'border-white/10'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-neutral-400">📍</span>
          {selected ? (
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{selected.name}</span>
              <span className={`text-[10px] ${STATUS_CONFIG[selected.status].color}`}>
                {STATUS_CONFIG[selected.status].label}
              </span>
            </div>
          ) : value === null && !loading ? (
            <span className="text-sm text-neutral-500">Select your city</span>
          ) : (
            <span className="animate-pulse text-sm text-neutral-500">Loading cities…</span>
          )}
        </div>
        <span className={`text-neutral-400 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1.5 flex max-h-72 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1f35] shadow-2xl">
          <div className="shrink-0 border-b border-white/5 p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search city…"
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {customMode ? (
              <div className="border-b border-white/5 p-3">
                <input
                  autoFocus
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customCity.trim().length >= 2) {
                      onChange(null, customCity.trim(), false);
                      setCustomMode(false);
                      setOpen(false);
                    }
                  }}
                  placeholder="e.g. Faizabad, Jhansi…"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-cyan-400"
                  onClick={() => {
                    if (customCity.trim().length < 2) return;
                    onChange(null, customCity.trim(), false);
                    setCustomMode(false);
                    setOpen(false);
                  }}
                >
                  Add city
                </button>
              </div>
            ) : null}

            {!customMode &&
              featured.map((city) => (
                <CityOption
                  key={city.id}
                  city={city}
                  isSelected={city.id === value}
                  onSelect={() => {
                    onChange(city.id, city.name, city.status === 'active');
                    setSearch('');
                    setOpen(false);
                  }}
                />
              ))}
            {!customMode &&
              others.map((city) => (
                <CityOption
                  key={city.id}
                  city={city}
                  isSelected={city.id === value}
                  onSelect={() => {
                    onChange(city.id, city.name, city.status === 'active');
                    setSearch('');
                    setOpen(false);
                  }}
                />
              ))}

            {!customMode && (
              <button
                type="button"
                onClick={() => setCustomMode(true)}
                className="w-full border-t border-white/5 px-3 py-3 text-left text-xs text-neutral-400 hover:bg-white/5"
              >
                My city isn&apos;t listed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CityOption({
  city,
  onSelect,
  isSelected,
}: {
  city: City;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const cfg = STATUS_CONFIG[city.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-white/5'}`}
    >
      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
      <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-cyan-400' : 'text-white'}`}>{city.name}</span>
      <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
    </button>
  );
}
