'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const base =
    'px-2.5 py-1 rounded-full text-xs font-semibold transition-colors transition-shadow duration-200';

  return (
    <div className="inline-flex items-center rounded-full bg-slate-900/5 border border-slate-200/70 shadow-sm px-1 py-0.5">
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`${base} ${
          language === 'en'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('hi')}
        className={`${base} ml-0.5 ${
          language === 'hi'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500'
        }`}
      >
        हिं
      </button>
    </div>
  );
}

