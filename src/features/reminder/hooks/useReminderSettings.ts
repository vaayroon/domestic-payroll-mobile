/**
 * Form-state hook for the reminder-settings screen (design D7). Loads
 * persisted preferences via `SettingsRepository` + the pure codec, exposes
 * editable local form state, and on submit: validates through
 * `serializeReminderPreferences` (throws on an out-of-range value, spec
 * RP-4 -- nothing persists), persists, requests notification permission
 * when the user is enabling the reminder, and reconciles the OS schedule
 * through the SAME `reconcileReminder` helper `ReminderProvider` uses
 * (design D5) -- there is only one place that decides what should
 * currently be scheduled.
 *
 * A failing initial load (settings read or permission read) degrades to
 * whatever state was already applied instead of rejecting.
 */

import { useEffect, useState } from 'react';

import { getReminderCopy, useTranslation } from '@/core/i18n';
import { useNotificationScheduler } from '@/core/NotifyServiceProvider';
import { useReminderReconcileQueue } from '@/core/ReminderReconcileQueue';
import { useSettingsRepository } from '@/core/RepositoryProvider';

import { reconcileReminder } from '../application/reconcileReminder';
import {
  DEFAULT_REMINDER_PREFERENCES,
  parseReminderPreferences,
  REMINDER_PREFERENCES_KEY,
  serializeReminderPreferences,
  type ReminderPreferences,
} from '../domain/preferences';

/** Save failure; screens map `code` with `t`. `save_failed` carries the technical message untranslated. */
export type ReminderSettingsSaveError = { readonly code: 'save_failed'; readonly detail: string };

export interface UseReminderSettingsResult {
  readonly loading: boolean;
  readonly values: ReminderPreferences;
  readonly setEnabled: (enabled: boolean) => void;
  readonly setDayOfMonth: (dayOfMonth: number) => void;
  readonly setHour: (hour: number) => void;
  readonly setMinute: (minute: number) => void;
  readonly submit: () => Promise<boolean>;
  readonly saving: boolean;
  readonly saveError: ReminderSettingsSaveError | null;
  /** True when the reminder is enabled but the OS permission is not granted -- the screen surfaces a banner. */
  readonly permissionDenied: boolean;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function useReminderSettings(): UseReminderSettingsResult {
  const settings = useSettingsRepository();
  const scheduler = useNotificationScheduler();
  const enqueueReconcile = useReminderReconcileQueue();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<ReminderPreferences>(DEFAULT_REMINDER_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ReminderSettingsSaveError | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const raw = await settings.get(REMINDER_PREFERENCES_KEY);
        if (cancelled) {
          return;
        }
        const loaded = parseReminderPreferences(raw);
        setValues(loaded);

        if (loaded.enabled) {
          const status = await scheduler.getPermissionStatus();
          if (!cancelled) {
            setPermissionDenied(status !== 'granted');
          }
        }
      } catch {
        // Without this catch the rejection escapes `void load()` below as an
        // unhandled promise rejection. Deliberately does NOT reset `values`:
        // if `settings.get()` failed, state still holds
        // DEFAULT_REMINDER_PREFERENCES; if the LATER permission read failed,
        // the preferences already loaded successfully and must not be thrown
        // away. Either way the screen stays usable and the user can edit and
        // save. The caught value is discarded without inspection.
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
  }, [settings, scheduler]);

  const setEnabled = (enabled: boolean) => setValues((current) => ({ ...current, enabled }));
  const setDayOfMonth = (dayOfMonth: number) => setValues((current) => ({ ...current, dayOfMonth: clamp(dayOfMonth, 1, 31) }));
  const setHour = (hour: number) => setValues((current) => ({ ...current, hour: clamp(hour, 0, 23) }));
  const setMinute = (minute: number) => setValues((current) => ({ ...current, minute: clamp(minute, 0, 59) }));

  const submit = async (): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    setPermissionDenied(false);
    try {
      const serialized = serializeReminderPreferences(values);

      if (values.enabled) {
        const status = await scheduler.requestPermission();
        if (status !== 'granted') {
          setPermissionDenied(true);
        }
      }

      await settings.set(REMINDER_PREFERENCES_KEY, serialized);
      // Through the shared queue: never overlaps a provider reconcile that may
      // have read the preferences before this save persisted them.
      await enqueueReconcile(() => reconcileReminder(scheduler, values, new Date(), getReminderCopy(t)));
      return true;
    } catch (caught) {
      setSaveError({ code: 'save_failed', detail: caught instanceof Error ? caught.message : String(caught) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    values,
    setEnabled,
    setDayOfMonth,
    setHour,
    setMinute,
    submit,
    saving,
    saveError,
    permissionDenied,
  };
}
