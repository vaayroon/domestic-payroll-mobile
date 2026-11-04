import i18next from 'i18next';
import { getLocales } from 'expo-localization';
import { initReactI18next } from 'react-i18next';

import { en } from './locales/en';
import { es } from './locales/es';
import { FALLBACK_LANGUAGE, resolveLanguage, SUPPORTED_LANGUAGES } from './resolveLanguage';

/**
 * Global instance, initialised synchronously at import time with bundled
 * catalogs so `t` works before the first render. The device language seeds it;
 * LanguageProvider swaps it once the stored override is read.
 */
// `use` is also a named export; the default instance method is the intended one.
// eslint-disable-next-line import/no-named-as-default-member
void i18next.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: resolveLanguage(null, getLocales()),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const i18n = i18next;
