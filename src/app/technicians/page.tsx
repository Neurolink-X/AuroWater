// 'use client';

// import React, { useMemo, useState } from 'react';
// import { useRouter } from 'next/navigation';

// export default function TechniciansPage() {
//   const router = useRouter();

//   type Technician = {
//     id: string;
//     name: string;
//     initials: string;
//     skills: string[];
//     city: string;
//     rating: number;
//     jobs: number;
//     verified: boolean;
//     available: boolean;
//     bgGradient: string;
//     preferredServiceKey: 'water_tanker' | 'ro_service' | 'plumbing' | 'borewell' | 'motor_pump' | 'tank_cleaning';
//   };

//   const colors = [
//     'from-blue-400 to-blue-600',
//     'from-green-400 to-green-600',
//     'from-purple-400 to-purple-600',
//     'from-orange-400 to-orange-600',
//     'from-pink-400 to-pink-600',
//   ];

//   const UP_CITIES = [
//     'Kanpur',
//     'Gorakhpur',
//     'Lucknow',
//     'Varanasi',
//     'Prayagraj',
//     'Agra',
//     'Meerut',
//     'Bareilly',
//     'Aligarh',
//     'Mathura',
//     'Delhi',
//     'Noida',
//     'Ghaziabad',
//   ] as const;

//   const pickGradient = (name: string) => {
//     const idx = (name.charCodeAt(0) || 0) % colors.length;
//     return colors[idx];
//   };

//   const techs: Technician[] = useMemo(
//     () => [
//       {
//         id: 't1',
//         name: 'Rahul Verma',
//         initials: 'RV',
//         skills: ['Plumbing', 'RO Service'],
//         city: 'Kanpur',
//         rating: 4.9,
//         jobs: 234,
//         verified: true,
//         available: true,
//         bgGradient: pickGradient('Rahul Verma'),
//         preferredServiceKey: 'plumbing',
//       },
//       {
//         id: 't2',
//         name: 'Suresh Kumar',
//         initials: 'SK',
//         skills: ['Borewell', 'Motor Repair'],
//         city: 'Gorakhpur',
//         rating: 4.8,
//         jobs: 189,
//         verified: true,
//         available: false,
//         bgGradient: pickGradient('Suresh Kumar'),
//         preferredServiceKey: 'borewell',
//       },
//       {
//         id: 't3',
//         name: 'Amit Srivastava',
//         initials: 'AS',
//         skills: ['Water Tanker', 'Tank Cleaning'],
//         city: 'Lucknow',
//         rating: 4.7,
//         jobs: 156,
//         verified: true,
//         available: true,
//         bgGradient: pickGradient('Amit Srivastava'),
//         preferredServiceKey: 'water_tanker',
//       },
//       {
//         id: 't4',
//         name: 'Pradeep Mishra',
//         initials: 'PM',
//         skills: ['Plumbing', 'Motor Repair'],
//         city: 'Varanasi',
//         rating: 4.9,
//         jobs: 312,
//         verified: true,
//         available: true,
//         bgGradient: pickGradient('Pradeep Mishra'),
//         preferredServiceKey: 'motor_pump',
//       },
//       {
//         id: 't5',
//         name: 'Vinod Yadav',
//         initials: 'VY',
//         skills: ['RO Service', 'Tank Cleaning'],
//         city: 'Prayagraj',
//         rating: 4.6,
//         jobs: 98,
//         verified: true,
//         available: false,
//         bgGradient: pickGradient('Vinod Yadav'),
//         preferredServiceKey: 'ro_service',
//       },
//       {
//         id: 't6',
//         name: 'Deepak Tiwari',
//         initials: 'DT',
//         skills: ['Borewell', 'Plumbing'],
//         city: 'Agra',
//         rating: 4.8,
//         jobs: 201,
//         verified: true,
//         available: true,
//         bgGradient: pickGradient('Deepak Tiwari'),
//         preferredServiceKey: 'borewell',
//       },
//     ],
//     []
//   );

//   const allCities = UP_CITIES;
//   const allSkills = useMemo(() => {
//     const set = new Set<string>();
//     techs.forEach((t) => t.skills.forEach((s) => set.add(s)));
//     return Array.from(set).sort();
//   }, [techs]);

//   const [skill, setSkill] = useState<string>('All');
//   const [city, setCity] = useState<string>('All');
//   const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);

//   const filtered = useMemo(() => {
//     return techs.filter((t) => {
//       if (onlyAvailable && !t.available) return false;
//       if (city !== 'All' && t.city !== city) return false;
//       if (skill !== 'All' && !t.skills.includes(skill)) return false;
//       return true;
//     });
//   }, [techs, onlyAvailable, city, skill]);

//   return (
//     <div className="min-h-screen gradient-section">
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
//         <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
//           <div>
//             <h1 className="text-[clamp(1.75rem,5vw,3.5rem)] font-extrabold text-[#0F1C18]">Technicians</h1>
//             <p className="text-base sm:text-lg text-slate-600 mt-3">
//               Verified pros across UP. Filter by city and skills, then book in seconds.
//             </p>
//           </div>
//           <button
//             type="button"
//             onClick={() => router.push('/contact')}
//             className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[#0D9B6C] text-white font-extrabold hover:bg-[#086D4C] active:scale-95 transition-all"
//           >
//             Join as Technician
//           </button>
//         </div>

//         <div className="mt-7 rounded-2xl border border-slate-100 bg-white/70 p-5">
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//             <div>
//               <label className="text-sm font-semibold text-slate-700">Skill</label>
//               <select
//                 value={skill}
//                 onChange={(e) => setSkill(e.target.value)}
//                 className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//               >
//                 <option value="All">All skills</option>
//                 {allSkills.map((s) => (
//                   <option key={s} value={s}>
//                     {s}
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <div>
//               <label className="text-sm font-semibold text-slate-700">City</label>
//               <select
//                 value={city}
//                 onChange={(e) => setCity(e.target.value)}
//                 className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//               >
//                 <option value="All">All cities</option>
//                 {allCities.map((c) => (
//                   <option key={c} value={c}>
//                     {c}
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <div>
//               <label className="text-sm font-semibold text-slate-700">Availability</label>
//               <button
//                 type="button"
//                 onClick={() => setOnlyAvailable((v) => !v)}
//                 className={[
//                   'mt-2 w-full rounded-full border px-4 py-2 text-sm font-extrabold transition-all',
//                   onlyAvailable ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
//                 ].join(' ')}
//               >
//                 {onlyAvailable ? 'Available only' : 'Show all'}
//               </button>
//             </div>
//           </div>
//         </div>

//         <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//           {filtered.map((t) => (
//             <article
//               key={t.id}
//               className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 hover:shadow-lg transition-shadow"
//             >
//               <div className="flex items-start justify-between gap-4">
//                 <div className="flex items-center gap-3">
//                   <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${t.bgGradient} flex items-center justify-center text-white font-extrabold`}>
//                     {t.initials}
//                   </div>
//                   <div>
//                     <div className="flex items-center gap-2">
//                       <div className="font-extrabold text-[#0F1C18]">{t.name}</div>
//                       {t.verified && (
//                         <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-[#E8F8F2] text-[#0D9B6C] border border-[#0D9B6C]">
//                           ✓ ID Verified
//                         </span>
//                       )}
//                     </div>
//                     <div className="text-sm text-slate-600 mt-1">
//                       {t.city} • {t.rating.toFixed(1)}★ • {t.jobs} jobs
//                     </div>
//                   </div>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <span className={t.available ? 'w-3 h-3 rounded-full bg-[#0D9B6C]' : 'w-3 h-3 rounded-full bg-slate-300'} aria-hidden="true" />
//                 </div>
//               </div>

//               <div className="mt-4 flex flex-wrap gap-2">
//                 {t.skills.slice(0, 3).map((s) => (
//                   <span key={s} className="text-xs font-semibold px-3 py-1 rounded-full border border-slate-200 text-slate-700 bg-white">
//                     {s}
//                   </span>
//                 ))}
//               </div>

//               <div className="mt-5">
//                 <button
//                   type="button"
//                   onClick={() => router.push(`/book?service=${encodeURIComponent(t.preferredServiceKey)}`)}
//                   className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
//                 >
//                   Book this Technician
//                 </button>
//               </div>
//             </article>
//           ))}
//         </div>

//         {filtered.length === 0 && (
//           <div className="mt-10 rounded-2xl border border-slate-100 bg-white/70 p-6 text-center text-slate-600">
//             No technicians match your filters. Try adjusting skill or city.
//           </div>
//         )}

//         <div className="mt-12 rounded-2xl bg-[#0D9B6C] text-white p-8 overflow-hidden relative">
//           <div className="absolute inset-0 opacity-15 hero-water-bg" />
//           <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//             <div>
//               <div className="font-extrabold text-2xl">Want to join our team?</div>
//               <div className="text-white/90 mt-2">Help customers get clean water and reliable repairs.</div>
//             </div>
//             <button type="button" onClick={() => router.push('/contact')} className="rounded-xl bg-white text-[#0D9B6C] px-5 py-3 font-extrabold hover:bg-white/90 active:scale-95 transition-all">
//               Start onboarding
//             </button>
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }







'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type ServiceKey = 'water_tanker' | 'ro_service' | 'plumbing' | 'borewell' | 'motor_pump' | 'tank_cleaning';

type Technician = {
  id: string;
  name: string;
  initials: string;
  skills: string[];
  city: string;
  rating: number;
  jobs: number;
  verified: boolean;
  available: boolean;
  preferredServiceKey: ServiceKey;
  speciality: string;
  experience: string;
};

const GRADIENT_PAIRS: [string, string][] = [
  ['#0D9B6C', '#065F46'],
  ['#0369A1', '#0C4A6E'],
  ['#7C3AED', '#4C1D95'],
  ['#DC2626', '#7F1D1D'],
  ['#D97706', '#78350F'],
];

const UP_CITIES = [
  'Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj',
  'Agra', 'Meerut', 'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad',
] as const;

const SKILL_ICONS: Record<string, string> = {
  'Plumbing': '🔧',
  'RO Service': '💧',
  'Borewell': '⛏️',
  'Motor Repair': '⚙️',
  'Water Tanker': '🚰',
  'Tank Cleaning': '🪣',
};

function pickGradient(name: string): [string, string] {
  return GRADIENT_PAIRS[(name.charCodeAt(0) || 0) % GRADIENT_PAIRS.length];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
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
}

function Avatar({ name, initials }: { name: string; initials: string }) {
  const [from, to] = pickGradient(name);
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${from}, ${to})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: 18,
        letterSpacing: '-0.5px',
        flexShrink: 0,
        boxShadow: `0 4px 14px ${from}55`,
      }}
    >
      {initials}
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'green' | 'default' | 'muted' }) {
  const styles: Record<string, React.CSSProperties> = {
    green: { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' },
    default: { background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' },
    muted: { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' },
  };
  return (
    <span
      style={{
        ...styles[variant],
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function TechnicianCard({ t, onBook }: { t: Technician; onBook: (key: ServiceKey) => void }) {
  const [hovered, setHovered] = useState(false);
  const [from] = pickGradient(t.name);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 20,
        border: '1.5px solid',
        borderColor: hovered ? '#0D9B6C' : '#F3F4F6',
        boxShadow: hovered
          ? '0 20px 48px rgba(13,155,108,0.12), 0 4px 16px rgba(0,0,0,0.06)'
          : '0 2px 12px rgba(0,0,0,0.06)',
        padding: 0,
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          height: 4,
          background: t.available
            ? 'linear-gradient(90deg, #0D9B6C, #34D399)'
            : 'linear-gradient(90deg, #D1D5DB, #9CA3AF)',
        }}
      />

      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={t.name} initials={t.initials} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-0.3px' }}>
                  {t.name}
                </span>
                {t.verified && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
                      color: '#065F46',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 999,
                      border: '1px solid #6EE7B7',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2.5" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    VERIFIED
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <StarRating rating={t.rating} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{t.rating.toFixed(1)}</span>
                <span style={{ color: '#D1D5DB', fontSize: 11 }}>•</span>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{t.jobs} jobs</span>
              </div>
            </div>
          </div>

          {/* Availability dot + label */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: t.available ? '#10B981' : '#D1D5DB',
                boxShadow: t.available ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none',
                animation: t.available ? 'pulse 2s infinite' : 'none',
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: t.available ? '#059669' : '#9CA3AF' }}>
              {t.available ? 'LIVE' : 'BUSY'}
            </span>
          </div>
        </div>

        {/* City + experience */}
        <div
          style={{
            background: '#F9FAFB',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M6.5 1.5C4.567 1.5 3 3.067 3 5c0 2.25 3.5 6.5 3.5 6.5S10 7.25 10 5c0-1.933-1.567-3.5-3.5-3.5zm0 4.75c-.69 0-1.25-.56-1.25-1.25S5.81 3.75 6.5 3.75 7.75 4.31 7.75 5 7.19 6.25 6.5 6.25z"
                fill="#9CA3AF"
              />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{t.city}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#9CA3AF" strokeWidth="1.2" />
              <path d="M6.5 3.5v3.2l2 2" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{t.experience}</span>
          </div>
        </div>

        {/* Skill tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {t.skills.map((s) => (
            <span
              key={s}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                color: '#374151',
                background: '#fff',
                border: '1.5px solid #E5E7EB',
                padding: '4px 10px',
                borderRadius: 999,
                letterSpacing: '0.02em',
              }}
            >
              <span style={{ fontSize: 12 }}>{SKILL_ICONS[s] ?? '🔩'}</span>
              {s}
            </span>
          ))}
        </div>

        {/* Speciality line */}
        <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5, fontStyle: 'italic' }}>
          "{t.speciality}"
        </p>

        {/* CTA */}
        <button
          type="button"
          onClick={() => onBook(t.preferredServiceKey)}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 12,
            background: t.available
              ? 'linear-gradient(135deg, #0D9B6C, #059652)'
              : '#F3F4F6',
            color: t.available ? '#fff' : '#9CA3AF',
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '-0.2px',
            border: 'none',
            cursor: t.available ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: t.available ? '0 4px 14px rgba(13,155,108,0.35)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (t.available) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(13,155,108,0.5)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.01)';
            }
          }}
          onMouseLeave={(e) => {
            if (t.available) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(13,155,108,0.35)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }
          }}
        >
          {t.available ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            appearance: 'none',
            background: '#fff',
            border: '1.5px solid #E5E7EB',
            borderRadius: 12,
            padding: '10px 36px 10px 14px',
            fontSize: 14,
            fontWeight: 600,
            color: '#111827',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#0D9B6C'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
        >
          <option value="All">{allLabel}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="14" height="14" viewBox="0 0 14 14" fill="none"
        >
          <path d="M3.5 5.5L7 9L10.5 5.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export default function TechniciansPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [skill, setSkill] = useState<string>('All');
  const [city, setCity] = useState<string>('All');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => { setMounted(true); }, []);

  const techs: Technician[] = useMemo(() => [
    {
      id: 't1', name: 'Rahul Verma', initials: 'RV',
      skills: ['Plumbing', 'RO Service'],
      city: 'Kanpur', rating: 4.9, jobs: 234,
      verified: true, available: true,
      preferredServiceKey: 'plumbing',
      speciality: 'Expert in leak detection & filtration systems',
      experience: '6 yrs exp',
    },
    {
      id: 't2', name: 'Suresh Kumar', initials: 'SK',
      skills: ['Borewell', 'Motor Repair'],
      city: 'Gorakhpur', rating: 4.8, jobs: 189,
      verified: true, available: false,
      preferredServiceKey: 'borewell',
      speciality: 'Specialist in deep borewell drilling & pumps',
      experience: '9 yrs exp',
    },
    {
      id: 't3', name: 'Amit Srivastava', initials: 'AS',
      skills: ['Water Tanker', 'Tank Cleaning'],
      city: 'Lucknow', rating: 4.7, jobs: 156,
      verified: true, available: true,
      preferredServiceKey: 'water_tanker',
      speciality: 'Bulk water supply & hygienic tank sanitization',
      experience: '5 yrs exp',
    },
    {
      id: 't4', name: 'Pradeep Mishra', initials: 'PM',
      skills: ['Plumbing', 'Motor Repair'],
      city: 'Varanasi', rating: 4.9, jobs: 312,
      verified: true, available: true,
      preferredServiceKey: 'motor_pump',
      speciality: 'Top-rated motor winding & pipe fitting expert',
      experience: '11 yrs exp',
    },
    {
      id: 't5', name: 'Vinod Yadav', initials: 'VY',
      skills: ['RO Service', 'Tank Cleaning'],
      city: 'Prayagraj', rating: 4.6, jobs: 98,
      verified: true, available: false,
      preferredServiceKey: 'ro_service',
      speciality: 'Certified RO membrane specialist',
      experience: '4 yrs exp',
    },
    {
      id: 't6', name: 'Deepak Tiwari', initials: 'DT',
      skills: ['Borewell', 'Plumbing'],
      city: 'Agra', rating: 4.8, jobs: 201,
      verified: true, available: true,
      preferredServiceKey: 'borewell',
      speciality: 'Underground pipeline & borewell inspection pro',
      experience: '8 yrs exp',
    },
  ], []);

  const allSkills = useMemo(() => {
    const set = new Set<string>();
    techs.forEach((t) => t.skills.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [techs]);

  const filtered = useMemo(() => {
    return techs.filter((t) => {
      if (onlyAvailable && !t.available) return false;
      if (city !== 'All' && t.city !== city) return false;
      if (skill !== 'All' && !t.skills.includes(skill)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.city.toLowerCase().includes(q) && !t.skills.some((s) => s.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [techs, onlyAvailable, city, skill, searchQuery]);

  const availableCount = techs.filter((t) => t.available).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        .tech-page * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }

        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
          50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(16,185,129,0.08); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .tech-page .card-grid > article {
          animation: fadeUp 0.5s ease both;
        }

        .tech-page .card-grid > article:nth-child(1) { animation-delay: 0ms; }
        .tech-page .card-grid > article:nth-child(2) { animation-delay: 60ms; }
        .tech-page .card-grid > article:nth-child(3) { animation-delay: 120ms; }
        .tech-page .card-grid > article:nth-child(4) { animation-delay: 180ms; }
        .tech-page .card-grid > article:nth-child(5) { animation-delay: 240ms; }
        .tech-page .card-grid > article:nth-child(6) { animation-delay: 300ms; }

        .tech-page .hero-badge {
          animation: fadeUp 0.4s ease both;
        }

        .tech-page input:focus, .tech-page select:focus {
          outline: none;
          border-color: #0D9B6C !important;
          box-shadow: 0 0 0 3px rgba(13,155,108,0.12);
        }
      `}</style>

      <div
        className="tech-page"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #F0FDF8 0%, #F9FAFB 60%, #fff 100%)',
        }}
      >
        {/* ── Hero section ── */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #022C22 0%, #064E3B 50%, #065F46 100%)',
            padding: '64px 24px 80px',
          }}
        >
          {/* decorative circles */}
          {[
            { w: 400, h: 400, top: -120, right: -100, opacity: 0.07 },
            { w: 200, h: 200, bottom: -60, left: -40, opacity: 0.05 },
            { w: 150, h: 150, top: 40, left: '40%', opacity: 0.04 },
          ].map((circle, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: circle.w,
                height: circle.h,
                top: circle.top,
                right: circle.right,
                bottom: circle.bottom,
                left: circle.left,
                borderRadius: '50%',
                background: '#34D399',
                opacity: circle.opacity,
                pointerEvents: 'none',
              }}
            />
          ))}

          {/* grid dots overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.06,
              backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              pointerEvents: 'none',
            }}
          />

          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {/* Live badge */}
            <div
              className="hero-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(52,211,153,0.15)',
                border: '1px solid rgba(52,211,153,0.35)',
                borderRadius: 999,
                padding: '6px 14px',
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#34D399',
                  display: 'inline-block',
                  animation: 'pulse 2s infinite',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.06em' }}>
                {availableCount} TECHNICIANS AVAILABLE NOW
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: '-1.5px',
                    lineHeight: 1.1,
                  }}
                >
                  Find Expert
                  <br />
                  <span style={{ color: '#34D399' }}>Water Technicians</span>
                </h1>
                <p style={{ margin: '16px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.65)', maxWidth: 460, lineHeight: 1.6 }}>
                  Verified professionals across Uttar Pradesh. Filter by city and skill, then book in seconds.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push('/contact')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#fff',
                  color: '#065F46',
                  fontWeight: 800,
                  fontSize: 14,
                  padding: '13px 22px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  letterSpacing: '-0.2px',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="6" r="3" stroke="#065F46" strokeWidth="1.5" />
                  <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Join as Technician
              </button>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                marginTop: 36,
                paddingTop: 32,
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {[
                { label: 'Active Technicians', value: techs.length },
                { label: 'Cities Covered', value: UP_CITIES.length },
                { label: 'Jobs Completed', value: '1,200+' },
                { label: 'Avg. Rating', value: '4.8★' },
              ].map((stat) => (
                <div key={stat.label} style={{ minWidth: 120 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: 500 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div style={{ maxWidth: 1200, margin: '-28px auto 0', padding: '0 24px', position: 'relative', zIndex: 10 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              border: '1.5px solid #E5E7EB',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              padding: '20px 24px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16,
                alignItems: 'end',
              }}
            >
              {/* Search */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  Search
                </label>
                <div style={{ position: 'relative' }}>
                  <svg
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    width="14" height="14" viewBox="0 0 14 14" fill="none"
                  >
                    <circle cx="6" cy="6" r="4.5" stroke="#9CA3AF" strokeWidth="1.4" />
                    <path d="M10 10L12.5 12.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Name, city or skill..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#fff',
                      border: '1.5px solid #E5E7EB',
                      borderRadius: 12,
                      padding: '10px 14px 10px 34px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#111827',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                </div>
              </div>

              <FilterSelect
                label="Skill"
                value={skill}
                onChange={setSkill}
                options={allSkills}
                allLabel="All skills"
              />

              <FilterSelect
                label="City"
                value={city}
                onChange={setCity}
                options={[...UP_CITIES]}
                allLabel="All cities"
              />

              {/* Availability toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  Availability
                </label>
                <button
                  type="button"
                  onClick={() => setOnlyAvailable((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: `1.5px solid ${onlyAvailable ? '#0D9B6C' : '#E5E7EB'}`,
                    background: onlyAvailable ? '#ECFDF5' : '#fff',
                    color: onlyAvailable ? '#065F46' : '#6B7280',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <span>{onlyAvailable ? 'Available only' : 'Show all'}</span>
                  {/* Toggle pill */}
                  <div
                    style={{
                      width: 34,
                      height: 18,
                      borderRadius: 999,
                      background: onlyAvailable ? '#0D9B6C' : '#D1D5DB',
                      position: 'relative',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: '#fff',
                        top: 3,
                        left: onlyAvailable ? 19 : 3,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Active filters + result count */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid #F3F4F6',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>Active filters:</span>
                {skill !== 'All' && <Badge variant="green">{skill}</Badge>}
                {city !== 'All' && <Badge variant="green">{city}</Badge>}
                {onlyAvailable && <Badge variant="green">Available now</Badge>}
                {searchQuery && <Badge variant="green">"{searchQuery}"</Badge>}
                {skill === 'All' && city === 'All' && !onlyAvailable && !searchQuery && (
                  <span style={{ fontSize: 12, color: '#D1D5DB' }}>None</span>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                {filtered.length} technician{filtered.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 60px' }}>
          {filtered.length > 0 ? (
            <div
              className="card-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 22,
              }}
            >
              {filtered.map((t) => (
                <TechnicianCard
                  key={t.id}
                  t={t}
                  onBook={(key) => router.push(`/book?service=${encodeURIComponent(key)}`)}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '72px 24px',
                background: '#fff',
                borderRadius: 20,
                border: '1.5px dashed #E5E7EB',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>No technicians found</h3>
              <p style={{ margin: '8px 0 24px', color: '#6B7280', fontSize: 14 }}>
                Try adjusting your filters or search query.
              </p>
              <button
                type="button"
                onClick={() => { setSkill('All'); setCity('All'); setOnlyAvailable(false); setSearchQuery(''); }}
                style={{
                  background: '#0D9B6C',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  padding: '10px 24px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* ── CTA Banner ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>
          <div
            style={{
              borderRadius: 24,
              background: 'linear-gradient(135deg, #022C22 0%, #065F46 60%, #0D9B6C 100%)',
              padding: '48px 40px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* decorative */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.05,
                backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: '#34D399', opacity: 0.08, pointerEvents: 'none' }} />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(52,211,153,0.15)',
                    border: '1px solid rgba(52,211,153,0.3)',
                    borderRadius: 999,
                    padding: '4px 12px',
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.07em' }}>
                    🏆 EARN ₹30,000+ / MONTH
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                  Want to join our expert team?
                </h2>
                <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}>
                  Help customers get clean water and reliable repairs. Flexible hours, great pay, and a growing community.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/contact')}
                style={{
                  background: '#fff',
                  color: '#065F46',
                  fontWeight: 800,
                  fontSize: 15,
                  padding: '14px 28px',
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                  letterSpacing: '-0.2px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
              >
                Start Onboarding
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="#065F46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}