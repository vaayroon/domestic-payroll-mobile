// Public surface of the i18n module. Deliberately NOT re-exported from the
// `@/core` barrel: receipt/legal modules must not be able to reach `t` through it.
export { useTranslation } from 'react-i18next';
export { i18n } from './i18n';
export type { Catalog } from './catalog';
export {
  FALLBACK_LANGUAGE,
  isSupportedLanguage,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './resolveLanguage';
export {
  parseLanguagePreference,
  serializeLanguagePreference,
  UI_LANGUAGE_KEY,
} from './languagePreference';
export { LanguageProvider, useLanguagePreference } from './LanguageProvider';
