/**
 * Save/clear hook for the employer's saved signature (design ADR-5/ADR-6).
 * Loads the persisted signature via `SettingsRepository` + the pure codec in
 * `@/core`, exposes the current saved payload, and lets the capture screen
 * save a freshly-drawn signature or clear an existing one.
 *
 * `saveError` is assigned ONLY from a fixed Spanish string literal, NEVER
 * from `caught` -- a deliberate departure from the
 * `caught instanceof Error ? caught.message : String(caught)` idiom used at
 * `useEmployerForm.ts`/`useReminderSettings.ts`. That idiom is safe only
 * when the thrown value provably cannot carry PII; here a non-`Error` throw
 * could stringify the signature payload straight into UI text (CLAUDE.md §6,
 * design ADR-6).
 */

import { useEffect, useState } from 'react';

import { useSettingsRepository } from '@/core/RepositoryProvider';

import {
  EMPLOYER_SIGNATURE_KEY,
  NO_EMPLOYER_SIGNATURE,
  parseEmployerSignature,
  serializeEmployerSignature,
} from '@/core/employerSignature';

/** Fixed Spanish copy -- the only string `saveError` is ever assigned from. */
const SAVE_ERROR_MESSAGE = 'No se pudo guardar la firma.';

export interface UseEmployerSignatureResult {
  readonly loading: boolean;
  readonly savedPngBase64: string | null;
  readonly save: (pngBase64: string) => Promise<boolean>;
  readonly clear: () => Promise<boolean>;
  readonly saving: boolean;
  /** FIXED Spanish copy only -- never a caught error's text. */
  readonly saveError: string | null;
}

export function useEmployerSignature(): UseEmployerSignatureResult {
  const settings = useSettingsRepository();

  const [loading, setLoading] = useState(true);
  const [savedPngBase64, setSavedPngBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const raw = await settings.get(EMPLOYER_SIGNATURE_KEY);
        if (cancelled) {
          return;
        }
        setSavedPngBase64(parseEmployerSignature(raw).pngBase64);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [settings]);

  const persist = async (pngBase64: string | null): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    try {
      const serialized = serializeEmployerSignature({ pngBase64, updatedAt: Date.now() });
      await settings.set(EMPLOYER_SIGNATURE_KEY, serialized);
      setSavedPngBase64(pngBase64);
      return true;
    } catch {
      setSaveError(SAVE_ERROR_MESSAGE);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = (pngBase64: string): Promise<boolean> => persist(pngBase64);

  const clear = (): Promise<boolean> => persist(NO_EMPLOYER_SIGNATURE.pngBase64);

  return { loading, savedPngBase64, save, clear, saving, saveError };
}
