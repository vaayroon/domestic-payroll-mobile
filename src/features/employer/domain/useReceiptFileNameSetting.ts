/**
 * State hook for the general receipt file-name setting screen (design D3 of
 * `sdd/receipt-file-name`). Loads the persisted format through
 * `SettingsRepository` and the pure codec in `@/core/receiptFileName`.
 * `select` only STAGES a choice in local state; nothing is written until
 * `submit` (the screen's "Guardar"), so leaving the screen discards it.
 * Modelled on `useEmployerSignature` / `useReminderSettings`.
 *
 * `saveError` is assigned ONLY from a fixed Spanish string, never from the
 * caught value, so a failure can never put library text into the UI. A failing
 * initial read degrades to "unset" (the random name) instead of blocking the
 * screen: the user can still pick and save a format.
 */

import { useEffect, useState } from 'react';

import {
  parseReceiptFileNameFormat,
  RECEIPT_FILE_NAME_FORMAT_KEY,
  serializeReceiptFileNameFormat,
} from '@/core/receiptFileName';
import { useSettingsRepository } from '@/core/RepositoryProvider';
import type { ReceiptFileNameFormatId } from '@/types';

/** Fixed Spanish copy: the only string `saveError` is ever assigned from. */
const SAVE_ERROR_MESSAGE = 'No se pudo guardar el ajuste.';

export interface UseReceiptFileNameSettingResult {
  readonly loading: boolean;
  /** The staged (or, before any selection, the persisted) format. `null` = random name. */
  readonly value: ReceiptFileNameFormatId | null;
  readonly select: (format: ReceiptFileNameFormatId | null) => void;
  /** Persists the staged value. Resolves `true` on success, `false` on failure. */
  readonly submit: () => Promise<boolean>;
  readonly saving: boolean;
  /** FIXED Spanish copy only, never a caught error's text. */
  readonly saveError: string | null;
}

export function useReceiptFileNameSetting(): UseReceiptFileNameSettingResult {
  const settings = useSettingsRepository();

  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState<ReceiptFileNameFormatId | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const raw = await settings.get(RECEIPT_FILE_NAME_FORMAT_KEY);
        if (!cancelled) {
          setValue(parseReceiptFileNameFormat(raw));
        }
      } catch {
        // A read failure degrades to "unset". The catch is deliberate: without
        // it the rejection escapes `void load()` as an unhandled rejection.
        if (!cancelled) {
          setValue(null);
        }
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

  const select = (format: ReceiptFileNameFormatId | null) => setValue(format);

  const submit = async (): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    try {
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, serializeReceiptFileNameFormat(value));
      return true;
    } catch {
      setSaveError(SAVE_ERROR_MESSAGE);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { loading, value, select, submit, saving, saveError };
}
