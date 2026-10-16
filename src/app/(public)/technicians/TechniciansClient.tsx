'use client';

import React, { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTechnicians } from '@/lib/api-client';

import { BRAND, DEFAULT_RATING, EARNINGS_CLAIM, SERVICES, SKILL_ICONS, UP_CITIES, type ServiceKey, type Technician } from './technicians-shared';

/* ───────────────────────── Constants & helpers ───────────────────────── */

const PAGE_SIZE = 12;
const CACHE_KEY = 'aurotap:technicians:v1';
const CACHE_TTL = 5 * 60 * 1000;
const SAVED_KEY = 'aurotap:saved-technicians';

const GRADIENT_PAIRS: [string, string][] = [
  ['#0D9B6C', '#065F46'],
  ['#0369A1', '#0C4A6E'],
  ['#7C3AED', '#4C1D95'],
  ['#DC2626', '#7F1D1D'],
  ['#D97706', '#78350F'],
];

const SORTS = [
  { id: 'best', label: 'Best match' },
  { id: 'rating', label: 'Top rated' },
  { id: 'jobs', label: 'Most jobs' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

function pickGradient(name: string): [string, string] {
  return GRADIENT_PAIRS[(name.charCodeAt(0) || 0) % GRADIENT_PAIRS.length];
}

function normalize(raw: unknown): Technician {
  const r = raw as Partial<Technician> & { name?: string; id?: string };
  const name = r.name || 'Technician';
  const initials = r.initials || name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  return {
    id: String(r.id ?? name),
    name,
    initials,
    skills: r.skills?.length ? r.skills : ['Plumbing'],
    city: r.city || 'Uttar Pradesh',
    rating: typeof r.rating === 'number' ? r.rating : DEFAULT_RATING,
    jobs: typeof r.jobs === 'number' ? r.jobs : 0,
    verified: r.verified !== false,
    available: r.available !== false,
    preferredServiceKey: (r.preferredServiceKey as ServiceKey) || 'plumbing',
    speciality: r.speciality || `${BRAND} technician`,
    experience: r.experience || 'On platform',
  };
}

const byRating = (a: Technician, b: Technician) => (b.rating ?? 0) - (a.rating ?? 0) || b.jobs - a.jobs;
const SORTERS: Record<SortId, (a: Technician, b: Technician) => number> = {
  best: (a, b) => Number(b.available) - Number(a.available) || byRating(a, b),
  rating: byRating,
  jobs: (a, b) => b.jobs - a.jobs || byRating(a, b),
};

/* ───────────────────────── Small components ───────────────────────── */

const StarRating = memo(function StarRating({ rating }: { rating: number }) {
  return (
    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <polygon
            points="6,1 7.5,4.5 11,5 8.5,7.5 9.2,11 6,9.2 2.8,11 3.5,7.5 1,5 4.5,4.5"
            fill={star <= Math.round(rating) ? '#F59E0B' : '#E5E7EB'}
          />
        </svg>
      ))}
    </span>
  );
});

const Avatar = memo(function Avatar({ name, initials }: { name: string; initials: string }) {
  const [from, to] = pickGradient(name);
  return (
    <div
      aria-hidden
      style={{
        width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${from}, ${to})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800,
        fontSize: 18, letterSpacing: '-0.5px', flexShrink: 0, boxShadow: `0 4px 14px ${from}55`,
      }}
    >
      {initials}
    </div>
  );
});

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'green' | 'default' | 'muted' }) {
  const styles: Record<string, React.CSSProperties> = {
    green: { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' },
    default: { background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' },
    muted: { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' },
  };
  return (
    <span style={{ ...styles[variant], padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

const SkeletonCard = () => (
  <div aria-hidden className="t-skel" style={{ height: 360, borderRadius: 20, border: '1.5px solid #F3F4F6', padding: 22 }} />
);

type CardProps = {
  t: Technician;
  saved: boolean;
  onBook: (key: ServiceKey) => void;
  onSave: (id: string) => void;
  onShare: (t: Technician) => void;
};

const TechnicianCard = memo(function TechnicianCard({ t, saved, onBook, onSave, onShare }: CardProps) {
  const iconBtn: React.CSSProperties = {
    width: 46, height: 46, borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
  };
  return (
    <article className="t-card" style={{ background: '#fff', borderRadius: 20, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Top accent bar */}
      <div style={{ height: 4, background: t.available ? 'linear-gradient(90deg, #0D9B6C, #34D399)' : 'linear-gradient(90deg, #D1D5DB, #9CA3AF)' }} />

      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Avatar name={t.name} initials={t.initials} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-0.3px' }}>{t.name}</h3>
                {t.verified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', color: '#065F46', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, border: '1px solid #6EE7B7', letterSpacing: '0.05em' }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
                      <path d="M1.5 4L3 5.5L6.5 2.5" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    VERIFIED
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {t.rating !== null ? (
                  <>
                    <StarRating rating={t.rating} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}><span className="sr-only">Rated </span>{t.rating.toFixed(1)}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#0369A1', background: '#E0F2FE', borderRadius: 999, padding: '2px 8px' }}>NEW</span>
                )}
                <span aria-hidden style={{ color: '#D1D5DB', fontSize: 11 }}>•</span>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{t.jobs} {t.jobs === 1 ? 'job' : 'jobs'}</span>
              </div>
            </div>
          </div>

          {/* Availability dot + label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: t.available ? '#10B981' : '#D1D5DB', boxShadow: t.available ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none', animation: t.available ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: t.available ? '#059669' : '#9CA3AF' }}>{t.available ? 'LIVE' : 'BUSY'}</span>
          </div>
        </div>

        {/* City + experience */}
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path d="M6.5 1.5C4.567 1.5 3 3.067 3 5c0 2.25 3.5 6.5 3.5 6.5S10 7.25 10 5c0-1.933-1.567-3.5-3.5-3.5zm0 4.75c-.69 0-1.25-.56-1.25-1.25S5.81 3.75 6.5 3.75 7.75 4.31 7.75 5 7.19 6.25 6.5 6.25z" fill="#9CA3AF" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{t.city}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <circle cx="6.5" cy="6.5" r="5" stroke="#9CA3AF" strokeWidth="1.2" />
              <path d="M6.5 3.5v3.2l2 2" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{t.experience}</span>
          </div>
        </div>

        {/* Skill tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {t.skills.map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#374151', background: '#fff', border: '1.5px solid #E5E7EB', padding: '4px 10px', borderRadius: 999, letterSpacing: '0.02em' }}>
              <span aria-hidden style={{ fontSize: 12 }}>{SKILL_ICONS[s] ?? '🔩'}</span>
              {s}
            </span>
          ))}
        </div>

        {/* Speciality line */}
        <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5, fontStyle: 'italic', flex: 1 }}>“{t.speciality}”</p>

        {/* CTA row: book, save, share */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="t-book"
            disabled={!t.available}
            onClick={() => onBook(t.preferredServiceKey)}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12,
              background: t.available ? 'linear-gradient(135deg, #0D9B6C, #059652)' : '#F3F4F6',
              color: t.available ? '#fff' : '#9CA3AF', fontWeight: 800, fontSize: 14, letterSpacing: '-0.2px', border: 'none',
              cursor: t.available ? 'pointer' : 'not-allowed', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, boxShadow: t.available ? '0 4px 14px rgba(13,155,108,0.35)' : 'none',
            }}
          >
            {t.available ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <rect x="1.5" y="3.5" width="11" height="9" rx="1.5" stroke="#fff" strokeWidth="1.3" />
                  <path d="M5 3V2M9 3V2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M1.5 6.5h11" stroke="#fff" strokeWidth="1.3" />
                </svg>
                Book Now
              </>
            ) : (
              'Currently Unavailable'
            )}
          </button>
          <button type="button" className="t-icon" onClick={() => onSave(t.id)} aria-pressed={saved} aria-label={saved ? `Remove ${t.name} from saved` : `Save ${t.name}`} style={{ ...iconBtn, color: saved ? '#E11D48' : '#6B7280', borderColor: saved ? '#FDA4AF' : '#E5E7EB' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9z" /></svg>
          </button>
          <button type="button" className="t-icon" onClick={() => onShare(t)} aria-label={`Share ${t.name} on WhatsApp`} style={{ ...iconBtn, color: '#6B7280' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          </button>
        </div>
      </div>
    </article>
  );
});

function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (v: string) => void; options: string[]; allLabel: string }) {
  const uid = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={uid} style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <select
          id={uid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', appearance: 'none', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '10px 36px 10px 14px', fontSize: 14, fontWeight: 600, color: '#111827', cursor: 'pointer', outline: 'none', transition: 'border-color 0.2s' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#0D9B6C'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
        >
          <option value="All">{allLabel}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M3.5 5.5L7 9L10.5 5.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase' };

/* ───────────────────────── Page ───────────────────────── */

export default function TechniciansClient({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const [skill, setSkill] = useState<string>('All');
  const [city, setCity] = useState<string>('All');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sort, setSort] = useState<SortId>('best');
  const [savedOnly, setSavedOnly] = useState(false);
  const filterKey = JSON.stringify([skill, city, onlyAvailable, deferredQuery, sort, savedOnly]);
  const [limitState, setLimitState] = useState<{ key: string; value: number }>({ key: '', value: PAGE_SIZE });
  const limit = limitState.key === filterKey ? limitState.value : PAGE_SIZE;

  const [techs, setTechs] = useState<Technician[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const hasData = useRef(false);
  const urlReady = useRef(false);

  const searchId = useId();
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => { router.prefetch('/book'); }, [router]);

  // Shared links reopen the same view. Apply browser-only state after mount to preserve SSR markup.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const p = new URLSearchParams(window.location.search);
      if (p.get('skill')) setSkill(p.get('skill') as string);
      if (p.get('city')) setCity(p.get('city') as string);
      if (p.get('available') === '1') setOnlyAvailable(true);
      if (p.get('q')) setSearchQuery(p.get('q') as string);
      const requestedSort = p.get('sort');
      if (SORTS.some((x) => x.id === requestedSort)) setSort(requestedSort as SortId);
      try {
        const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) setSaved(parsed);
      } catch { /* ignore invalid local storage */ }
    });
    return () => { cancelled = true; };
  }, []);

  // Keep the URL in sync (debounced).
  useEffect(() => {
    if (!urlReady.current) { urlReady.current = true; return; }
    const id = setTimeout(() => {
      const p = new URLSearchParams();
      if (skill !== 'All') p.set('skill', skill);
      if (city !== 'All') p.set('city', city);
      if (onlyAvailable) p.set('available', '1');
      if (searchQuery.trim()) p.set('q', searchQuery.trim());
      if (sort !== 'best') p.set('sort', sort);
      const qs = p.toString();
      window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }, 350);
    return () => clearTimeout(id);
  }, [skill, city, onlyAvailable, searchQuery, sort]);

  // Paint cached data asynchronously, then refresh stale data from the network.
  useEffect(() => {
    let cancelled = false;
    let freshCache = false;
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { at: number; rows: Technician[] };
        if (Array.isArray(c.rows) && c.rows.length) {
          hasData.current = true;
          freshCache = Date.now() - c.at < CACHE_TTL;
          queueMicrotask(() => {
            if (cancelled) return;
            setTechs(c.rows);
            setListLoading(false);
          });
        }
      }
    } catch { /* ignore invalid cache */ }
    if (freshCache) return () => { cancelled = true; };
    setLoadError(false);
    void getTechnicians()
      .then((rows) => {
        if (cancelled) return;
        const mapped = (Array.isArray(rows) ? rows : []).map(normalize);
        setTechs(mapped);
        hasData.current = mapped.length > 0;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows: mapped })); } catch { /* ignore */ }
      })
      .catch(() => {
        if (cancelled) return;
        if (!hasData.current) { setTechs([]); setLoadError(true); }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => { cancelled = true; };
  }, [reload]);

  const allSkills = useMemo(() => {
    const set = new Set<string>(SERVICES.map((s) => s.skill));
    techs.forEach((t) => t.skills.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [techs]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    techs.forEach((t) => t.skills.forEach((s) => m.set(s, (m.get(s) ?? 0) + 1)));
    return m;
  }, [techs]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return techs
      .filter((t) => {
        if (onlyAvailable && !t.available) return false;
        if (savedOnly && !saved.includes(t.id)) return false;
        if (city !== 'All' && t.city !== city) return false;
        if (skill !== 'All' && !t.skills.includes(skill)) return false;
        if (needle && !t.name.toLowerCase().includes(needle) && !t.city.toLowerCase().includes(needle) && !t.skills.some((s) => s.toLowerCase().includes(needle))) return false;
        return true;
      })
      .sort(SORTERS[sort]);
  }, [techs, onlyAvailable, savedOnly, saved, city, skill, deferredQuery, sort]);

  const availableCount = useMemo(() => techs.filter((t) => t.available).length, [techs]);
  const visible = filtered.slice(0, limit);
  const clearAll = () => { setSkill('All'); setCity('All'); setOnlyAvailable(false); setSearchQuery(''); setSavedOnly(false); };

  const onBook = useCallback((key: ServiceKey) => router.push(`/book?service=${encodeURIComponent(key)}`), [router]);
  const onSave = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const onShare = useCallback((t: Technician) => {
    const text = `${t.name}, ${t.skills.join(' and ')} in ${t.city} on ${BRAND}: ${window.location.origin}${window.location.pathname}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <>
      <style>{`
        .tech-page * { box-sizing: border-box; font-family: inherit; }
        .tech-page .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }

        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
          50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(16,185,129,0.08); }
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        .tech-page .card-grid > article { animation: fadeUp 0.5s ease both; }
        .tech-page .card-grid > article:nth-child(1) { animation-delay: 0ms; }
        .tech-page .card-grid > article:nth-child(2) { animation-delay: 60ms; }
        .tech-page .card-grid > article:nth-child(3) { animation-delay: 120ms; }
        .tech-page .card-grid > article:nth-child(4) { animation-delay: 180ms; }
        .tech-page .card-grid > article:nth-child(5) { animation-delay: 240ms; }
        .tech-page .card-grid > article:nth-child(6) { animation-delay: 300ms; }
        .tech-page .hero-badge { animation: fadeUp 0.4s ease both; }

        /* Hover is CSS, not React state: no re-render per mouse move */
        .tech-page .t-card { border: 1.5px solid #F3F4F6; box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s, border-color .25s; }
        .tech-page .t-card:hover { border-color: #0D9B6C; box-shadow: 0 20px 48px rgba(13,155,108,0.12), 0 4px 16px rgba(0,0,0,0.06); transform: translateY(-4px); }
        .tech-page .t-book:not(:disabled):hover { box-shadow: 0 6px 20px rgba(13,155,108,0.5) !important; transform: scale(1.01); }
        .tech-page .t-icon:hover { border-color: #0D9B6C !important; }
        .tech-page .lift:hover { transform: translateY(-2px); }
        .tech-page .t-skel { background: linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; }

        .tech-page input:focus, .tech-page select:focus { outline: none; border-color: #0D9B6C !important; box-shadow: 0 0 0 3px rgba(13,155,108,0.12); }
        .tech-page button:focus-visible, .tech-page a:focus-visible { outline: 3px solid rgba(13,155,108,0.55); outline-offset: 2px; }
        .tech-page .chips { scrollbar-width: none; }
        .tech-page .chips::-webkit-scrollbar { display: none; }
        .tech-page .m-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, rgba(255,255,255,0), #fff 40%); }
        @media (min-width: 1024px) { .tech-page .m-bar { display: none; } }
        @media (prefers-reduced-motion: reduce) { .tech-page * { animation: none !important; transition: none !important; } }
      `}</style>

      <div className="tech-page" style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #F0FDF8 0%, #F9FAFB 60%, #fff 100%)' }}>
        {/* ── Hero section ── */}
        <header style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #022C22 0%, #064E3B 50%, #065F46 100%)', padding: '48px 24px 80px' }}>
          {/* decorative circles */}
          {[
            { w: 400, h: 400, top: -120, right: -100, opacity: 0.07 },
            { w: 200, h: 200, bottom: -60, left: -40, opacity: 0.05 },
            { w: 150, h: 150, top: 40, left: '40%', opacity: 0.04 },
          ].map((circle, i) => (
            <div key={i} aria-hidden style={{ position: 'absolute', width: circle.w, height: circle.h, top: circle.top, right: circle.right, bottom: circle.bottom, left: circle.left, borderRadius: '50%', background: '#34D399', opacity: circle.opacity, pointerEvents: 'none' }} />
          ))}

          {/* grid dots overlay */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {/* Live badge */}
            <div className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 999, padding: '6px 14px', marginBottom: 20 }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.06em' }} aria-live="polite">
                {listLoading ? 'FINDING TECHNICIANS…' : `${availableCount} TECHNICIANS AVAILABLE NOW`}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                  Find Expert
                  <br />
                  <span style={{ color: '#34D399' }}>Water Technicians</span>
                </h1>
                <p style={{ margin: '16px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.65)', maxWidth: 520, lineHeight: 1.6 }}>
                  Browse professionals listed for currently supported service zones in {UP_CITIES.join(', ')}. Compare ratings, jobs done and live availability, then book in a few taps.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                  <a href="#technician-list" className="lift" style={{ display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, #34D399, #10B981)', color: '#022C22', fontWeight: 800, fontSize: 14, padding: '13px 22px', borderRadius: 12, textDecoration: 'none', transition: 'all 0.2s' }}>
                    Browse technicians
                  </a>
                </div>
              </div>

              <button
                type="button"
                className="lift"
                onClick={() => router.push('/register/pro?role=plumber')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 14, padding: '13px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', letterSpacing: '-0.2px', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="8" cy="6" r="3" stroke="#065F46" strokeWidth="1.5" />
                  <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Join as Technician
              </button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 36, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {[
                { label: 'Active Technicians', value: techs.length },
                { label: 'Cities Covered', value: UP_CITIES.length },
                { label: 'Service Categories', value: '6' },
                { label: 'Service Zones', value: String(UP_CITIES.length) },
              ].map((stat) => (
                <div key={stat.label} style={{ minWidth: 120 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: 500 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ── Filter bar ── */}
        <div id="technician-list" style={{ maxWidth: 1200, margin: '-28px auto 0', padding: '0 24px', position: 'relative', zIndex: 10, scrollMarginTop: 12 }}>
          <div role="search" style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #E5E7EB', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, alignItems: 'end' }}>
              {/* Search */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor={searchId} style={LABEL}>Search</label>
                <div style={{ position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <circle cx="6" cy="6" r="4.5" stroke="#9CA3AF" strokeWidth="1.4" />
                    <path d="M10 10L12.5 12.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <input
                    id={searchId}
                    type="search"
                    placeholder="Name, city or skill..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '10px 14px 10px 34px', fontSize: 14, fontWeight: 600, color: '#111827', outline: 'none', transition: 'border-color 0.2s' }}
                  />
                </div>
              </div>

              <FilterSelect label="Skill" value={skill} onChange={setSkill} options={allSkills} allLabel="All skills" />
              <FilterSelect label="City" value={city} onChange={setCity} options={[...UP_CITIES]} allLabel="All cities" />

              {/* Sort */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <FilterSortSelect value={sort} onChange={setSort} />
              </div>

              {/* Availability toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={LABEL}>Availability</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={onlyAvailable}
                  onClick={() => setOnlyAvailable((v) => !v)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${onlyAvailable ? '#0D9B6C' : '#E5E7EB'}`, background: onlyAvailable ? '#ECFDF5' : '#fff', color: onlyAvailable ? '#065F46' : '#6B7280', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <span>{onlyAvailable ? 'Available only' : 'Show all'}</span>
                  {/* Toggle pill */}
                  <div aria-hidden style={{ width: 34, height: 18, borderRadius: 999, background: onlyAvailable ? '#0D9B6C' : '#D1D5DB', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', width: 12, height: 12, borderRadius: '50%', background: '#fff', top: 3, left: onlyAvailable ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                  </div>
                </button>
              </div>
            </div>

            {/* Service chips (quick filter) */}
            <div className="chips" role="group" aria-label="Filter by service" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 16, paddingBottom: 4 }}>
              {[{ skill: 'All', label: 'All services', icon: '✨' }, ...SERVICES].map((s) => {
                const on = skill === s.skill;
                const n = s.skill === 'All' ? techs.length : counts.get(s.skill) ?? 0;
                return (
                  <button
                    key={s.skill}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSkill(s.skill)}
                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${on ? '#0D9B6C' : '#E5E7EB'}`, background: on ? '#ECFDF5' : '#fff', color: on ? '#065F46' : '#4B5563', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <span aria-hidden>{s.icon}</span>{s.label}
                    {!listLoading && <span style={{ fontSize: 11, color: on ? '#047857' : '#9CA3AF' }}>{n}</span>}
                  </button>
                );
              })}
            </div>

            {/* Active filters + result count */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid #F3F4F6', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>Active filters:</span>
                {skill !== 'All' && <Badge variant="green">{skill}</Badge>}
                {city !== 'All' && <Badge variant="green">{city}</Badge>}
                {onlyAvailable && <Badge variant="green">Available now</Badge>}
                {savedOnly && <Badge variant="green">Saved</Badge>}
                {searchQuery && <Badge variant="green">&quot;{searchQuery}&quot;</Badge>}
                {skill === 'All' && city === 'All' && !onlyAvailable && !savedOnly && !searchQuery ? (
                  <span style={{ fontSize: 12, color: '#D1D5DB' }}>None</span>
                ) : (
                  <button type="button" onClick={clearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#047857', textDecoration: 'underline', padding: '2px 4px' }}>Clear</button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  aria-pressed={savedOnly}
                  onClick={() => setSavedOnly((v) => !v)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${savedOnly ? '#FDA4AF' : '#E5E7EB'}`, background: savedOnly ? '#FFF1F2' : '#fff', color: savedOnly ? '#E11D48' : '#6B7280', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  ♥ Saved{saved.length ? ` (${saved.length})` : ''}
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }} aria-live="polite">
                  {filtered.length} technician{filtered.length !== 1 ? 's' : ''} found
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 60px' }}>
          {listLoading ? (
            <div aria-busy="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 22 }}>
              {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
              <p className="sr-only">Loading technicians…</p>
            </div>
          ) : loadError && techs.length === 0 ? (
            <div role="alert" style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: 20, border: '1.5px dashed #E5E7EB' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }} aria-hidden>📡</div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>Could not load technicians</h3>
              <p style={{ margin: '8px 0 24px', color: '#6B7280', fontSize: 14 }}>Check your connection and try again.</p>
              <button type="button" onClick={() => { setListLoading(true); setReload((n) => n + 1); }} style={{ background: '#0D9B6C', color: '#fff', fontWeight: 800, fontSize: 14, padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                Try again
              </button>
            </div>
          ) : filtered.length > 0 ? (
            <>
              <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 22 }}>
                {visible.map((t) => (
                  <TechnicianCard key={t.id} t={t} saved={saved.includes(t.id)} onBook={onBook} onSave={onSave} onShare={onShare} />
                ))}
              </div>
              {filtered.length > visible.length && (
                <div style={{ textAlign: 'center', marginTop: 32 }}>
                  <button type="button" onClick={() => setLimitState((current) => ({
                    key: filterKey,
                    value: (current.key === filterKey ? current.value : PAGE_SIZE) + PAGE_SIZE,
                  }))} style={{ background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 14, padding: '12px 28px', borderRadius: 12, border: '1.5px solid #0D9B6C', cursor: 'pointer' }}>
                    Show more ({filtered.length - visible.length} left)
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '72px 24px', background: '#fff', borderRadius: 20, border: '1.5px dashed #E5E7EB' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden>🔍</div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>
                {techs.length === 0 ? 'No technicians on the platform yet' : 'No technicians found'}
              </h3>
              <p style={{ margin: '8px 0 24px', color: '#6B7280', fontSize: 14 }}>
                {techs.length === 0
                  ? 'Approved technicians will appear here after our team reviews their application. You can join as a technician today.'
                  : 'Try adjusting your filters or search query.'}
              </p>
              {techs.length === 0 ? (
                <Link href="/register/pro?role=plumber" style={{ background: '#0D9B6C', color: '#fff', fontWeight: 800, fontSize: 14, padding: '10px 24px', borderRadius: 12, textDecoration: 'none', display: 'inline-block' }}>
                  Become a technician
                </Link>
              ) : (
                <button type="button" onClick={clearAll} style={{ background: '#0D9B6C', color: '#fff', fontWeight: 800, fontSize: 14, padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Server-rendered SEO sections (services, why, FAQ) */}
        {children}

        {/* ── CTA Banner ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>
          <div style={{ borderRadius: 24, background: 'linear-gradient(135deg, #022C22 0%, #065F46 60%, #0D9B6C 100%)', padding: '48px 40px', position: 'relative', overflow: 'hidden' }}>
            {/* decorative */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
            <div aria-hidden style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: '#34D399', opacity: 0.08, pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
              <div>
                {EARNINGS_CLAIM && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '4px 12px', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.07em' }}>🏆 {EARNINGS_CLAIM}</span>
                  </div>
                )}
                <h2 style={{ margin: 0, fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                  Want to join our expert team?
                </h2>
                <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}>
                  Help customers get clean water and reliable repairs. Flexible hours, great pay, and a growing community.
                </p>
              </div>
              <button
                type="button"
                className="lift"
                onClick={() => router.push('/register/pro?role=plumber')}
                style={{ background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 15, padding: '14px 28px', borderRadius: 14, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', letterSpacing: '-0.2px' }}
              >
                Start Onboarding
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="#065F46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile booking bar */}
        <div className="m-bar">
          <Link href="/book" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 14, background: 'linear-gradient(135deg, #0D9B6C, #059652)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 14px rgba(13,155,108,0.35)' }}>
            Book a service
          </Link>
        </div>
      </div>
    </>
  );
}

function FilterSortSelect({ value, onChange }: { value: SortId; onChange: (v: SortId) => void }) {
  const uid = useId();
  return (
    <>
      <label htmlFor={uid} style={LABEL}>Sort by</label>
      <div style={{ position: 'relative' }}>
        <select
          id={uid}
          value={value}
          onChange={(e) => onChange(e.target.value as SortId)}
          style={{ width: '100%', appearance: 'none', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '10px 36px 10px 14px', fontSize: 14, fontWeight: 600, color: '#111827', cursor: 'pointer', outline: 'none', transition: 'border-color 0.2s' }}
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M3.5 5.5L7 9L10.5 5.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </>
  );
}
