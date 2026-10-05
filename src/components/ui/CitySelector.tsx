'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react';

import type { City } from '@/lib/cities';
import { FALLBACK_CITIES } from '@/lib/cities';
import { safeSessionGet, safeSessionSet } from '@/lib/storage';

export type { City };

type Props = {
  value: string | null;
  onChange: (
    cityId: string | null,
    cityName: string,
    isActive: boolean
  ) => void;
  className?: string;
};

const STATUS_CONFIG = {
  active: {
    label: 'Available',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  coming_soon: {
    label: 'Coming soon',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  waitlist: {
    label: 'Join waitlist',
    dot: 'bg-slate-400',
    text: 'text-slate-400',
    bg: 'bg-slate-400/10',
  },
} as const;

const CACHE_KEY = 'aw_cities';
const CACHE_TTL = 5 * 60 * 1000;

export default function CitySelector({
  value,
  onChange,
  className,
}: Props) {
  const [cities, setCities] = useState<City[]>(FALLBACK_CITIES);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customMode, setCustomMode] = useState(false);
  const [customCity, setCustomCity] = useState('');

  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    let cancelled = false;

    const raw = safeSessionGet(CACHE_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          data?: City[];
          ts?: number;
        };

        if (
          Array.isArray(parsed.data) &&
          Date.now() - (parsed.ts ?? 0) < CACHE_TTL
        ) {
          setCities(parsed.data);
          setLoading(false);
          return;
        }
      } catch {
        // Ignore invalid cache.
      }
    }

    void fetch('/api/cities')
      .then(async (response) => {
        if (!response.ok) {
          return FALLBACK_CITIES;
        }

        const data = (await response.json()) as City[];

        return Array.isArray(data)
          ? data
          : FALLBACK_CITIES;
      })
      .then((data) => {
        if (cancelled) return;

        setCities(data);

        safeSessionSet(
          CACHE_KEY,
          JSON.stringify({
            data,
            ts: Date.now(),
          })
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCities(FALLBACK_CITIES);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      );
    };
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return cities;

    return cities.filter((city) =>
      city.name.toLowerCase().includes(query)
    );
  }, [cities, search]);

  const featured = filtered.filter(
    (city) => city.is_featured
  );

  const others = filtered.filter(
    (city) => !city.is_featured
  );

  const selected = cities.find(
    (city) => city.id === value
  );

  const selectedStatus = selected
    ? STATUS_CONFIG[selected.status]
    : null;

  function selectCity(city: City) {
    onChange(
      city.id,
      city.name,
      city.status === 'active'
    );

    setSearch('');
    setCustomMode(false);
    setCustomCity('');
    setOpen(false);
  }

  function submitCustomCity() {
    const cityName = customCity.trim();

    if (cityName.length < 2) return;

    onChange(null, cityName, false);

    setCustomMode(false);
    setCustomCity('');
    setSearch('');
    setOpen(false);
  }

  function handleKeyDown(
    event: React.KeyboardEvent
  ) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (
      event.key === 'Enter' &&
      customMode
    ) {
      event.preventDefault();
      submitCustomCity();
    }
  }

  return (
    <div
      ref={ref}
      className={`relative w-full ${className ?? ''}`}
    >
      {/* Trigger */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((current) => !current);

          if (customMode) {
            setCustomMode(false);
          }
        }}
        className={[
          'group flex min-h-[58px] w-full items-center justify-between gap-3',
          'rounded-2xl border px-4 py-3 text-left',
          'bg-[#0d1f35] transition-all duration-200',
          'focus:outline-none focus-visible:ring-4',
          'focus-visible:ring-cyan-500/15',
          open
            ? 'border-cyan-400/50 shadow-lg shadow-cyan-950/20'
            : 'border-white/10 hover:border-white/20',
        ].join(' ')}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
            <MapPin
              className="h-[18px] w-[18px] text-cyan-400"
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0">
            {selected ? (
              <>
                <span className="block truncate text-sm font-semibold text-white">
                  {selected.name}
                </span>

                {selectedStatus && (
                  <span
                    className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${selectedStatus.text}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${selectedStatus.dot}`}
                    />

                    {selectedStatus.label}
                  </span>
                )}
              </>
            ) : loading ? (
              <>
                <span className="block h-3.5 w-28 animate-pulse rounded bg-white/10" />

                <span className="mt-2 block h-2.5 w-20 animate-pulse rounded bg-white/5" />
              </>
            ) : (
              <>
                <span className="block text-sm font-medium text-white">
                  Select your city
                </span>

                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Check service availability
                </span>
              </>
            )}
          </div>
        </div>

        <ChevronDown
          className={[
            'h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200',
            open ? 'rotate-180 text-cyan-400' : '',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Select your city"
          onKeyDown={handleKeyDown}
          className="
            absolute
            left-0
            right-0
            top-full
            z-[70]
            mt-2
            overflow-hidden
            rounded-2xl
            border
            border-white/10
            bg-[#0d1f35]
            shadow-2xl
            shadow-black/30
          "
        >
          {/* Search */}
          <div className="border-b border-white/5 p-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />

              <input
                ref={inputRef}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search your city..."
                aria-label="Search city"
                className="
                  h-11
                  w-full
                  rounded-xl
                  border
                  border-white/10
                  bg-white/5
                  pl-9
                  pr-9
                  text-sm
                  text-white
                  placeholder:text-slate-500
                  outline-none
                  transition
                  focus:border-cyan-500/50
                  focus:bg-white/[0.07]
                "
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear city search"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"
                >
                  <X
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
          </div>

          {/* Custom city */}
          {customMode ? (
            <div className="border-b border-white/5 p-3">
              <div className="mb-2">
                <p className="text-sm font-semibold text-white">
                  Your city isn't listed
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Tell us your city and we'll check availability.
                </p>
              </div>

              <input
                autoFocus
                value={customCity}
                onChange={(event) =>
                  setCustomCity(event.target.value)
                }
                onKeyDown={handleKeyDown}
                placeholder="Enter city name"
                aria-label="Enter your city"
                className="
                  h-11
                  w-full
                  rounded-xl
                  border
                  border-white/10
                  bg-white/5
                  px-3
                  text-sm
                  text-white
                  placeholder:text-slate-500
                  outline-none
                  focus:border-cyan-500/50
                "
              />

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setCustomCity('');
                  }}
                  className="flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  Back
                </button>

                <button
                  type="button"
                  disabled={customCity.trim().length < 2}
                  onClick={submitCustomCity}
                  className="
                    flex-1
                    rounded-xl
                    bg-cyan-500
                    px-3
                    py-2.5
                    text-xs
                    font-bold
                    text-slate-950
                    transition
                    hover:bg-cyan-400
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="max-h-[280px] overflow-y-auto p-1.5">
              {/* Empty state */}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                    <MapPin
                      className="h-5 w-5 text-slate-500"
                      aria-hidden="true"
                    />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-white">
                    City not found
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    You can add your city manually.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomMode(true);
                      setCustomCity(search);
                    }}
                    className="mt-4 rounded-xl bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/15"
                  >
                    Add my city
                  </button>
                </div>
              )}

              {/* Featured */}
              {featured.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Popular cities
                  </div>

                  {featured.map((city) => (
                    <CityOption
                      key={city.id}
                      city={city}
                      isSelected={city.id === value}
                      onSelect={() => selectCity(city)}
                    />
                  ))}
                </>
              )}

              {/* Other cities */}
              {others.length > 0 && (
                <>
                  {featured.length > 0 && (
                    <div className="mt-1 border-t border-white/5 px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Other cities
                    </div>
                  )}

                  {others.map((city) => (
                    <CityOption
                      key={city.id}
                      city={city}
                      isSelected={city.id === value}
                      onSelect={() => selectCity(city)}
                    />
                  ))}
                </>
              )}

              {/* Custom city */}
              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(true);
                    setCustomCity('');
                  }}
                  className="
                    mt-1
                    flex
                    w-full
                    items-center
                    justify-between
                    rounded-xl
                    border-t
                    border-white/5
                    px-3
                    py-3
                    text-left
                    text-xs
                    text-slate-400
                    transition
                    hover:bg-white/5
                    hover:text-white
                  "
                >
                  <span>
                    My city isn't listed
                  </span>

                  <span className="text-cyan-400">
                    Add →
                  </span>
                </button>
              )}
            </div>
          )}
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
  const config = STATUS_CONFIG[city.status];

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className={[
        'flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
        'transition-colors duration-150',
        isSelected
          ? 'bg-cyan-500/10'
          : 'hover:bg-white/5',
      ].join(' ')}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`}
        aria-hidden="true"
      />

      <span
        className={[
          'min-w-0 flex-1 truncate text-sm font-medium',
          isSelected
            ? 'text-cyan-400'
            : 'text-white',
        ].join(' ')}
      >
        {city.name}
      </span>

      <span
        className={[
          'shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold',
          config.bg,
          config.text,
        ].join(' ')}
      >
        {config.label}
      </span>

      {isSelected && (
        <Check
          className="h-4 w-4 shrink-0 text-cyan-400"
          aria-hidden="true"
        />
      )}
    </button>
  );
}









// 'use client';

// import { useEffect, useRef, useState } from 'react';
// import type { City } from '@/lib/cities';
// import { FALLBACK_CITIES } from '@/lib/cities';
// import { safeSessionGet, safeSessionSet } from '@/lib/storage';

// export type { City };

// type Props = {
//   value: string | null;
//   onChange: (cityId: string | null, cityName: string, isActive: boolean) => void;
//   className?: string;
// };

// const STATUS_CONFIG = {
//   active: { label: 'Available', color: 'text-emerald-400', dot: 'bg-emerald-400' },
//   coming_soon: { label: 'Coming soon', color: 'text-yellow-400', dot: 'bg-yellow-400' },
//   waitlist: { label: 'Join waitlist', color: 'text-neutral-400', dot: 'bg-neutral-500' },
// } as const;

// const CACHE_KEY = 'aw_cities';
// const CACHE_TTL = 5 * 60 * 1000;

// export default function CitySelector({ value, onChange, className }: Props) {
//   const [cities, setCities] = useState<City[]>(FALLBACK_CITIES);
//   const [search, setSearch] = useState('');
//   const [open, setOpen] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [customMode, setCustomMode] = useState(false);
//   const [customCity, setCustomCity] = useState('');
//   const ref = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     let cancelled = false;
//     const raw = safeSessionGet(CACHE_KEY);
//     if (raw) {
//       try {
//         const parsed = JSON.parse(raw) as { data?: City[]; ts?: number };
//         if (parsed.data && Date.now() - (parsed.ts ?? 0) < CACHE_TTL) {
//           setCities(parsed.data);
//           setLoading(false);
//           return;
//         }
//       } catch {
//         /* ignore */
//       }
//     }

//     void fetch('/api/cities')
//       .then(async (r) => (r.ok ? ((await r.json()) as City[]) : FALLBACK_CITIES))
//       .then((data) => {
//         if (cancelled || !Array.isArray(data)) return;
//         setCities(data);
//         safeSessionSet(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
//       })
//       .catch(() => {
//         if (!cancelled) setCities(FALLBACK_CITIES);
//       })
//       .finally(() => {
//         if (!cancelled) setLoading(false);
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   useEffect(() => {
//     const handler = (e: MouseEvent) => {
//       if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
//     };
//     document.addEventListener('mousedown', handler);
//     return () => document.removeEventListener('mousedown', handler);
//   }, []);

//   const filtered = cities.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
//   const featured = filtered.filter((c) => c.is_featured);
//   const others = filtered.filter((c) => !c.is_featured);
//   const selected = cities.find((c) => c.id === value);

//   return (
//     <div ref={ref} className={`relative ${className ?? ''}`}>
//       <button
//         type="button"
//         onClick={() => setOpen((o) => !o)}
//         className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-[#0d1f35] px-4 py-3 text-left ${
//           open ? 'border-cyan-500/50' : 'border-white/10'
//         }`}
//       >
//         <div className="flex min-w-0 items-center gap-2">
//           <span className="shrink-0 text-neutral-400">📍</span>
//           {selected ? (
//             <div className="min-w-0">
//               <span className="block truncate text-sm font-medium text-white">{selected.name}</span>
//               <span className={`text-[10px] ${STATUS_CONFIG[selected.status].color}`}>
//                 {STATUS_CONFIG[selected.status].label}
//               </span>
//             </div>
//           ) : value === null && !loading ? (
//             <span className="text-sm text-neutral-500">Select your city</span>
//           ) : (
//             <span className="animate-pulse text-sm text-neutral-500">Loading cities…</span>
//           )}
//         </div>
//         <span className={`text-neutral-400 ${open ? 'rotate-180' : ''}`}>▾</span>
//       </button>

//       {open && (
//         <div className="absolute top-full right-0 left-0 z-50 mt-1.5 flex max-h-72 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1f35] shadow-2xl">
//           <div className="shrink-0 border-b border-white/5 p-2">
//             <input
//               autoFocus
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               placeholder="Search city…"
//               className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none"
//             />
//           </div>
//           <div className="flex-1 overflow-y-auto">
//             {customMode ? (
//               <div className="border-b border-white/5 p-3">
//                 <input
//                   autoFocus
//                   value={customCity}
//                   onChange={(e) => setCustomCity(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && customCity.trim().length >= 2) {
//                       onChange(null, customCity.trim(), false);
//                       setCustomMode(false);
//                       setOpen(false);
//                     }
//                   }}
//                   placeholder="e.g. Faizabad, Jhansi…"
//                   className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
//                 />
//                 <button
//                   type="button"
//                   className="mt-2 text-xs text-cyan-400"
//                   onClick={() => {
//                     if (customCity.trim().length < 2) return;
//                     onChange(null, customCity.trim(), false);
//                     setCustomMode(false);
//                     setOpen(false);
//                   }}
//                 >
//                   Add city
//                 </button>
//               </div>
//             ) : null}

//             {!customMode &&
//               featured.map((city) => (
//                 <CityOption
//                   key={city.id}
//                   city={city}
//                   isSelected={city.id === value}
//                   onSelect={() => {
//                     onChange(city.id, city.name, city.status === 'active');
//                     setSearch('');
//                     setOpen(false);
//                   }}
//                 />
//               ))}
//             {!customMode &&
//               others.map((city) => (
//                 <CityOption
//                   key={city.id}
//                   city={city}
//                   isSelected={city.id === value}
//                   onSelect={() => {
//                     onChange(city.id, city.name, city.status === 'active');
//                     setSearch('');
//                     setOpen(false);
//                   }}
//                 />
//               ))}

//             {!customMode && (
//               <button
//                 type="button"
//                 onClick={() => setCustomMode(true)}
//                 className="w-full border-t border-white/5 px-3 py-3 text-left text-xs text-neutral-400 hover:bg-white/5"
//               >
//                 My city isn&apos;t listed
//               </button>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// function CityOption({
//   city,
//   onSelect,
//   isSelected,
// }: {
//   city: City;
//   onSelect: () => void;
//   isSelected: boolean;
// }) {
//   const cfg = STATUS_CONFIG[city.status];
//   return (
//     <button
//       type="button"
//       onClick={onSelect}
//       className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-white/5'}`}
//     >
//       <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
//       <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-cyan-400' : 'text-white'}`}>{city.name}</span>
//       <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
//     </button>
//   );
// }
