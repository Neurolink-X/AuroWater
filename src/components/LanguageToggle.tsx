'use client';

import React from 'react';
import { Check, Languages } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selection"
      className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur-md"
    >
      {/* Language icon */}
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400"
        aria-hidden="true"
      >
        <Languages size={16} />
      </span>

      {/* English */}
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        aria-label="Switch language to English"
        className={[
          'relative flex min-h-8 items-center justify-center gap-1.5',
          'rounded-lg px-3 text-xs font-bold',
          'transition-all duration-200',
          'focus:outline-none focus-visible:ring-2',
          'focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
          language === 'en'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')}
      >
        {language === 'en' && (
          <Check size={13} strokeWidth={2.5} aria-hidden="true" />
        )}
        <span>EN</span>
      </button>

      {/* Hindi */}
      <button
        type="button"
        onClick={() => setLanguage('hi')}
        aria-pressed={language === 'hi'}
        aria-label="भाषा हिंदी में बदलें"
        className={[
          'relative flex min-h-8 items-center justify-center gap-1.5',
          'rounded-lg px-3 text-xs font-bold',
          'transition-all duration-200',
          'focus:outline-none focus-visible:ring-2',
          'focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
          language === 'hi'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')}
      >
        {language === 'hi' && (
          <Check size={13} strokeWidth={2.5} aria-hidden="true" />
        )}
        <span>हिंदी</span>
      </button>
    </div>
  );
}
