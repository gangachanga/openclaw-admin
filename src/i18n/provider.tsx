'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from './en.json';
import es from './es.json';

type Locale = 'en' | 'es';
type Dictionary = typeof en;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const dictionaries: Record<Locale, Dictionary> = {
  en,
  es,
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Load locale from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('openclaw-locale');
    if (stored === 'en' || stored === 'es') {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('openclaw-locale', newLocale);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = dictionaries[locale];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = dictionaries['en'];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object') {
            value = value[fallbackKey];
          } else {
            return key; // Return key if not found in fallback either
          }
        }
        return value || key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
