/**
 * In-memory `NotificationScheduler` fake for unit tests (mirrors
 * `services/pdf/testing/fakes.ts` / `services/mail/testing/fakes.ts`). Real
 * `expo-notifications` cannot run under `jest-expo` headless, so
 * `reconcileReminder` and the settings hook are exercised against this fake
 * instead, through `NotifyServiceProvider`.
 */

import type { NotificationPermissionStatus, NotificationScheduler } from '@/types';

export class FakeNotificationScheduler implements NotificationScheduler {
  /** Controls what `getPermissionStatus()`/`requestPermission()` resolve to. */
  permissionStatus: NotificationPermissionStatus = 'undetermined';

  /** True once `ensureChannel()` has been called at least once. */
  channelEnsured = false;
  /** The `fireDate` passed to the most recent `scheduleReminder` call, for assertions. */
  lastFireDate: Date | null = null;
  /** True once `cancelReminder()` has been called at least once. */
  cancelled = false;
  /** Number of times `scheduleReminder` was called. */
  scheduleCallCount = 0;
  /** Controls what the next `consumeStartupTap()` call resolves to; auto-resets to `false` after being consumed once, mirroring the real adapter. */
  startupTapPending = false;

  private nextId = 0;
  private tapListeners: (() => void)[] = [];

  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    return this.permissionStatus;
  }

  async requestPermission(): Promise<NotificationPermissionStatus> {
    return this.permissionStatus;
  }

  async ensureChannel(): Promise<void> {
    this.channelEnsured = true;
  }

  async scheduleReminder(fireDate: Date): Promise<string> {
    this.cancelled = true; // scheduleReminder always cancels-then-schedules (design D1).
    this.lastFireDate = fireDate;
    this.scheduleCallCount += 1;
    this.nextId += 1;
    return `fake-reminder-${this.nextId}`;
  }

  async cancelReminder(): Promise<void> {
    this.cancelled = true;
    this.lastFireDate = null;
  }

  async consumeStartupTap(): Promise<boolean> {
    const pending = this.startupTapPending;
    this.startupTapPending = false;
    return pending;
  }

  onTap(listener: () => void): () => void {
    this.tapListeners.push(listener);
    return () => {
      this.tapListeners = this.tapListeners.filter((registered) => registered !== listener);
    };
  }

  /** Test helper: simulates a live (foreground/background) default-action tap, notifying every registered `onTap` listener. */
  simulateTap(): void {
    for (const listener of this.tapListeners) {
      listener();
    }
  }
}
