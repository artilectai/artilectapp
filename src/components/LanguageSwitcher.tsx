'use client';

import { useTranslation } from 'react-i18next';
import i18nInstance from '@/i18n/config';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation('app');
  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'uz', label: "O'zbekcha" }
  ];

  return (
    <div className="flex gap-2">
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => {
            if (i18nInstance.isInitialized) {
              i18nInstance.changeLanguage(l.code);
            } else {
              i18nInstance.on('initialized', () => i18nInstance.changeLanguage(l.code));
            }
          }}
          className={`px-3 py-1 rounded-md text-sm border ${
            i18n.resolvedLanguage === l.code
              ? 'bg-money-green text-black'
              : 'bg-surface-1 border-border'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
