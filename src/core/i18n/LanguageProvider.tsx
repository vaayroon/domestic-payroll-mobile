/**
 * Owns the UI-language override (design D8/D10). Mounted directly inside the
 * repositories provider: it reads `ui.language` once, applies the resolved
 * language to the global i18n instance BEFORE rendering children (no wrong-
 * language flash), and keeps the instance in sync afterwards, including a
 * device-language change while following the device.
 *
 * Imports repositories by relative path (not the `@/core` barrel, which does
 * not re-export i18n) so no import cycle is created.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocales } from 'expo-localization';

import { useSettingsRepository } from '../RepositoryProvider';
import { i18n } from './i18n';
import { parseLanguagePreference, serializeLanguagePreference, UI_LANGUAGE_KEY } from './languagePreference';
import { resolveLanguage, type SupportedLanguage } from './resolveLanguage';

interface LanguagePreferenceValue {
  /** The stored override, or `null` when following the device. */
  readonly preference: SupportedLanguage | null;
  /** The language actually in use. */
  readonly language: SupportedLanguage;
  /** Persists first, then updates state. Rejects when the write fails. */
  readonly setPreference: (preference: SupportedLanguage | null) => Promise<void>;
}

const LanguagePreferenceContext = createContext<LanguagePreferenceValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const settings = useSettingsRepository();
  const locales = useLocales();
  const localesRef = useRef(locales);
  localesRef.current = locales;

  const [loaded, setLoaded] = useState(false);
  const [preference, setPreferenceState] = useState<SupportedLanguage | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let stored: SupportedLanguage | null = null;
      try {
        stored = parseLanguagePreference(await settings.get(UI_LANGUAGE_KEY));
      } catch {
        // A failed read means "follow the device".
        stored = null;
      }
      if (cancelled) {
        return;
      }
      await i18n.changeLanguage(resolveLanguage(stored, localesRef.current));
      if (cancelled) {
        return;
      }
      setPreferenceState(stored);
      setLoaded(true);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [settings]);

  const language = resolveLanguage(preference, locales);

  useEffect(() => {
    if (loaded && i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [loaded, language]);

  const setPreference = useCallback(
    async (next: SupportedLanguage | null) => {
      await settings.set(UI_LANGUAGE_KEY, serializeLanguagePreference(next));
      setPreferenceState(next);
    },
    [settings],
  );

  const value = useMemo(() => ({ preference, language, setPreference }), [preference, language, setPreference]);

  if (!loaded) {
    return null;
  }

  return <LanguagePreferenceContext.Provider value={value}>{children}</LanguagePreferenceContext.Provider>;
}

export function useLanguagePreference(): LanguagePreferenceValue {
  const value = useContext(LanguagePreferenceContext);
  if (value === null) {
    throw new Error('useLanguagePreference must be called within a <LanguageProvider>.');
  }
  return value;
}
