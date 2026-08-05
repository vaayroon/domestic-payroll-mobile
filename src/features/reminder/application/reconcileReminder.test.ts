import { FakeNotificationScheduler } from '@/services/notify/testing/fakes';

import type { ReminderPreferences } from '../domain/preferences';
import { reconcileReminder } from './reconcileReminder';

const NOW = new Date(2026, 3, 3, 8, 0); // April 3, 08:00 -- fixed, injected clock.

function basePrefs(overrides: Partial<ReminderPreferences> = {}): ReminderPreferences {
  return { enabled: true, dayOfMonth: 5, hour: 9, minute: 0, ...overrides };
}

describe('reconcileReminder', () => {
  it('disabled -> cancels any existing reminder and never schedules', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';

    await reconcileReminder(scheduler, basePrefs({ enabled: false }), NOW);

    expect(scheduler.cancelled).toBe(true);
    expect(scheduler.scheduleCallCount).toBe(0);
  });

  it('enabled but permission denied -> no-op, no crash', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'denied';

    await expect(reconcileReminder(scheduler, basePrefs(), NOW)).resolves.toBeUndefined();

    expect(scheduler.channelEnsured).toBe(false);
    expect(scheduler.scheduleCallCount).toBe(0);
  });

  it('enabled and granted -> ensures the channel and schedules the next computed fire date', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';

    await reconcileReminder(scheduler, basePrefs(), NOW);

    expect(scheduler.channelEnsured).toBe(true);
    expect(scheduler.scheduleCallCount).toBe(1);
    expect(scheduler.lastFireDate).not.toBeNull();
    expect(scheduler.lastFireDate?.getDate()).toBe(5);
    expect(scheduler.lastFireDate?.getHours()).toBe(9);
  });
});
