'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Avoid importing JSON modules directly (Turbopack HMR issues with paths containing parentheses).
// Instead, initialize without resources and load them at runtime from /public/locales.
export const resources = {} as const;

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      supportedLngs: ['en', 'ru', 'uz'],
      ns: ['app'],
      defaultNS: 'app',
      detection: {
        // querystring ?lng=ru, localStorage i18nextLng, or browser
        order: ['querystring', 'localStorage', 'navigator'],
        caches: ['localStorage']
      },
      interpolation: { escapeValue: false }
    })
    .then(() => {
      if (typeof window === 'undefined') return;
      const langs = ['en', 'ru', 'uz'] as const;
      langs.forEach(async (lng) => {
        try {
          // In dev, add a tiny cache buster to pick up live edits
          const url = `/locales/${lng}/app.json${process.env.NODE_ENV === 'development' ? `?v=${Date.now()}` : ''}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load ${url}`);
          const data = await res.json();
          i18n.addResourceBundle(lng, 'app', data, true, true);
        } catch (e) {
          // Non-fatal; fallback strings may appear until loaded
          console.error('i18n load error:', e);
        }
      });
    });
}

export default i18n;
