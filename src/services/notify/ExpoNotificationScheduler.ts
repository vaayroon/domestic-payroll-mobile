/**
 * Concrete `NotificationScheduler` adapter wrapping `expo-notifications`.
 * This is the ONLY file allowed to import `expo-notifications` (enforced by
 * the `no-restricted-imports` ESLint rule in `eslint.config.js`, mirroring
 * the `expo-print`/`expo-mail-composer` seals) -- `features/*` and `core/*`
 * depend on the `NotificationScheduler` interface in `src/types` instead.
 *
 * Repetition is deliberately NOT a native `MONTHLY` trigger (undocumented
 * day-31 clamping behavior + Android long-interval alarm drift, decision
 * #764 point 4): this adapter only ever knows how to schedule ONE future
 * `Date` under a FIXED identifier. `computeNextFireDate` (pure) decides
 * *when* that next occurrence is; `reconcileReminder` re-invokes this
 * adapter on foreground/tap to roll the one-shot forward.
 *
 * `scheduleReminder` always cancels-then-schedules under the same fixed
 * `REMINDER_IDENTIFIER`, so rescheduling is idempotent without persisting or
 * querying any notification id (design D1) -- `cancelScheduledNotificationAsync`
 * resolves successfully even when nothing is currently scheduled for that id.
 */

import * as Notifications from 'expo-notifications';

import type { NotificationPermissionStatus, NotificationScheduler, ReminderNotificationContent } from '@/types';

/** Fixed, well-known identifier -- there is only ever one reminder scheduled at a time. */
const REMINDER_IDENTIFIER = 'monthly-payroll-reminder';
/** Must match the `defaultChannel` configured in the `expo-notifications` app.json plugin (design D6). */
const CHANNEL_ID = 'payroll-reminder';

function toPermissionStatus(status: Notifications.PermissionStatus): NotificationPermissionStatus {
  switch (status) {
    case Notifications.PermissionStatus.GRANTED:
      return 'granted';
    case Notifications.PermissionStatus.DENIED:
      return 'denied';
    case Notifications.PermissionStatus.UNDETERMINED:
      return 'undetermined';
  }
}

export class ExpoNotificationScheduler implements NotificationScheduler {
  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    const response = await Notifications.getPermissionsAsync();
    return toPermissionStatus(response.status);
  }

  async requestPermission(): Promise<NotificationPermissionStatus> {
    // On Android 13+ this triggers the `POST_NOTIFICATIONS` runtime prompt;
    // on older Android versions the permission is granted at install time.
    const response = await Notifications.requestPermissionsAsync();
    return toPermissionStatus(response.status);
  }

  async ensureChannel(name: string): Promise<void> {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  async scheduleReminder(fireDate: Date, content: ReminderNotificationContent): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER);
    return Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDENTIFIER,
      content: {
        title: content.title,
        body: content.body,
        data: { url: '/payroll/new' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        channelId: CHANNEL_ID,
      },
    });
  }

  async cancelReminder(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER);
  }

  async consumeStartupTap(): Promise<boolean> {
    const response = Notifications.getLastNotificationResponse();
    if (response === null || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return false;
    }
    Notifications.clearLastNotificationResponse();
    return true;
  }

  onTap(listener: () => void): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        listener();
      }
    });
    return () => subscription.remove();
  }
}
