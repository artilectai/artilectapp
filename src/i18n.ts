import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

if (!i18n.isInitialized) {
  i18n
    .use(HttpBackend) // remove if you bundle JSONs via imports
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: 'en',
      supportedLngs: ['en', 'ru', 'uz'],
      ns: ['app'],
      defaultNS: 'app',
      backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
      detection: { order: ['querystring', 'localStorage', 'navigator'], caches: ['localStorage'] },
      interpolation: { escapeValue: false }
    });
}

export default i18n;
