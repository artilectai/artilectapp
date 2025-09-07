'use client';

// Ensure i18n is initialized on the client only
import i18n from '@/i18n/config';

export default function I18nClientInit() {
  // No UI; importing config initializes i18n via initReactI18next on client
  return null;
}
