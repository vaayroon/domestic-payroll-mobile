/**
 * Shared reschedule orchestration (design D5) -- the ONE code path used by
 * BOTH `ReminderProvider` (mount / `AppState` active / notification tap) and
 * the settings-save hook, so "what should currently be scheduled" is decided
 * in exactly one place. The clock (`now`) is INJECTED, never read from
 * `Date.now()` inside, so this stays testable with a fixed `Date` and the
 * `FakeNotificationScheduler`.
 */

import type { NotificationScheduler, ReminderCopy } from '@/types';

import { computeNextFireDate } from '../domain/nextFireDate';
import type { ReminderPreferences } from '../domain/preferences';

/**
 * Reconciles the OS-scheduled reminder against `prefs`:
 * - disabled -> cancel any existing reminder.
 * - enabled but permission not granted -> no-op (never crashes; the settings
 *   UI owns prompting/surfacing the denied state).
 * - enabled and granted -> ensure the Android channel exists (named from
 *   `copy`, so a language change renames it), then schedule the next
 *   occurrence computed from `now` with the same localized `copy`.
 */
export async function reconcileReminder(
  scheduler: NotificationScheduler,
  prefs: ReminderPreferences,
  now: Date,
  copy: ReminderCopy,
): Promise<void> {
  if (!prefs.enabled) {
    await scheduler.cancelReminder();
    return;
  }

  const status = await scheduler.getPermissionStatus();
  if (status !== 'granted') {
    return;
  }

  await scheduler.ensureChannel(copy.channelName);
  const fireDate = computeNextFireDate(now, prefs.dayOfMonth, prefs.hour, prefs.minute);
  await scheduler.scheduleReminder(fireDate, { title: copy.title, body: copy.body });
}
