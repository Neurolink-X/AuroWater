'use client';

/* This component intentionally hydrates browser state after mount. */
/* eslint-disable react-hooks/set-state-in-effect */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { translations, type Language } from './translations';
import { safeGet, safeSet } from '@/lib/storage';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

const STORAGE_KEY = 'auro_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = safeGet(STORAGE_KEY) as Language | null;
    if (stored === 'hi' || stored === 'en') {
      setLanguageState(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    safeSet(STORAGE_KEY, language);

    // Apply font-family override for Hindi
    const body = document.body;
    if (language === 'hi') {
      body.style.fontFamily =
        "'Noto Sans Devanagari', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    } else {
      body.style.fontFamily =
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string) => translations[language][key] ?? key,
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

