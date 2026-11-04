export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Language used when neither an override nor a supported device language exists. */
export const FALLBACK_LANGUAGE: SupportedLanguage = 'es';

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Resolves the UI language: the stored override, else the first device locale
 * (in OS preference order) whose language code is supported, else Spanish.
 * Pure: the caller passes the device locales in.
 */
export function resolveLanguage(
  preference: SupportedLanguage | null,
  locales: readonly { languageCode: string | null }[],
): SupportedLanguage {
  if (preference !== null) {
    return preference;
  }
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase() ?? null;
    if (isSupportedLanguage(code)) {
      return code;
    }
  }
  return FALLBACK_LANGUAGE;
}
