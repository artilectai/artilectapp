'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';

type Props = { className?: string };

export default function TopLanguageBar({ className = '' }: Props) {
  const { i18n: i18next } = useTranslation('app');

  const langs = [
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' },
    { code: 'uz', label: 'UZ' },
  ] as const;

  // 1) Stable SSR default -> no mismatch on first paint
  const [lang, setLang] = useState<'en' | 'ru' | 'uz'>('en');

  // 2) Sync actual language on client after mount
  useEffect(() => {
    try {
      const fromStorage = (localStorage.getItem('i18nextLng') || '').split('-')[0];
      const fromI18n = (i18next.resolvedLanguage || i18next.language || 'en').split('-')[0];
      const detected = (fromStorage || fromI18n) as 'en' | 'ru' | 'uz';
      if (detected && detected !== lang) setLang(detected);
    } catch {}
  }, []); // run once

  const change = (code: 'en' | 'ru' | 'uz') => {
    setLang(code); // optimistic UI keeps SSR/CSR in sync
    if (i18n.isInitialized) i18n.changeLanguage(code);
    else i18n.on('initialized', () => i18n.changeLanguage(code));
    try {
      localStorage.setItem('i18nextLng', code);
      document.documentElement.lang = code;
    } catch {}
  };

  return (
    <div
      className={`fixed top-0 inset-x-0 z-50 flex justify-center pt-safe-top pointer-events-none ${className}`}
      suppressHydrationWarning
    >
      <div className="inline-flex items-center gap-1 rounded-full border border-money-green/30 bg-premium-black/70 backdrop-blur px-1.5 py-1 shadow-[0_0_0_1px_rgba(0,213,99,0.25),0_0_22px_rgba(0,213,99,0.25)] pointer-events-auto">
        {langs.map((l) => {
          const active = lang === l.code;
          return (
            <button
              key={l.code}
              onClick={() => change(l.code)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                active
                  ? 'text-black bg-money-green shadow-[0_0_10px_rgba(0,213,99,0.8)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-money-green/10'
              }`}
              aria-pressed={active}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}