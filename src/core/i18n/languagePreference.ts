import { isSupportedLanguage, type SupportedLanguage } from './resolveLanguage';

/** Settings KV key holding the UI language override. */
export const UI_LANGUAGE_KEY = 'ui.language';

/** Stored value meaning "follow the device language". */
const FOLLOW_DEVICE = '';

/**
 * Lenient: anything that is not exactly a supported language (missing, empty,
 * garbage) reads as "follow device" (`null`), never as an error.
 */
export function parseLanguagePreference(raw: string | null): SupportedLanguage | null {
  return isSupportedLanguage(raw) ? raw : null;
}

/**
 * Strict: only the picker calls it with a closed set of options, so an unknown
 * value is a programming error. `null` (follow device) is stored as `''`.
 */
export function serializeLanguagePreference(preference: SupportedLanguage | null): string {
  if (preference === null) {
    return FOLLOW_DEVICE;
  }
  if (!isSupportedLanguage(preference)) {
    throw new RangeError('Unsupported UI language preference.');
  }
  return preference;
}
