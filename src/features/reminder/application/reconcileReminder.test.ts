import { FakeNotificationScheduler } from '@/services/notify/testing/fakes';

import type { ReminderCopy } from '@/types';

import type { ReminderPreferences } from '../domain/preferences';
import { reconcileReminder } from './reconcileReminder';

const NOW = new Date(2026, 3, 3, 8, 0); // April 3, 08:00 -- fixed, injected clock.

const ES_COPY: ReminderCopy = {
  channelName: 'Recordatorio de nómina',
  title: 'Recordatorio de nómina',
  body: 'Es hora de generar la nómina de este mes.',
};

const EN_COPY: ReminderCopy = {
  channelName: 'Payroll reminder',
  title: 'Payroll reminder',
  body: "It's time to run this month's payroll.",
};

function basePrefs(overrides: Partial<ReminderPreferences> = {}): ReminderPreferences {
  return { enabled: true, dayOfMonth: 5, hour: 9, minute: 0, ...overrides };
}

describe('reconcileReminder', () => {
  it('disabled -> cancels any existing reminder and never schedules', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';

    await reconcileReminder(scheduler, basePrefs({ enabled: false }), NOW, ES_COPY);

    expect(scheduler.cancelled).toBe(true);
    expect(scheduler.scheduleCallCount).toBe(0);
  });

  it('enabled but permission denied -> no-op, no crash', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'denied';

    await expect(reconcileReminder(scheduler, basePrefs(), NOW, ES_COPY)).resolves.toBeUndefined();

    expect(scheduler.channelEnsured).toBe(false);
    expect(scheduler.scheduleCallCount).toBe(0);
  });

  it('enabled and granted -> ensures the channel and schedules the next computed fire date', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';

    await reconcileReminder(scheduler, basePrefs(), NOW, ES_COPY);

    expect(scheduler.channelEnsured).toBe(true);
    expect(scheduler.scheduleCallCount).toBe(1);
    expect(scheduler.lastFireDate).not.toBeNull();
    expect(scheduler.lastFireDate?.getDate()).toBe(5);
    expect(scheduler.lastFireDate?.getHours()).toBe(9);
  });

  it('passes the channel name, title and body from the given copy to the scheduler', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';

    await reconcileReminder(scheduler, basePrefs(), NOW, EN_COPY);

    expect(scheduler.lastChannelName).toBe('Payroll reminder');
    expect(scheduler.lastContent).toEqual({ title: 'Payroll reminder', body: "It's time to run this month's payroll." });
  });

  it('re-ensures the channel and reschedules with the new copy when the language changes', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';

    await reconcileReminder(scheduler, basePrefs(), NOW, ES_COPY);
    await reconcileReminder(scheduler, basePrefs(), NOW, EN_COPY);

    expect(scheduler.scheduleCallCount).toBe(2);
    expect(scheduler.lastChannelName).toBe('Payroll reminder');
    expect(scheduler.lastContent?.title).toBe('Payroll reminder');
  });

  it('disabled -> schedules nothing regardless of the copy', async () => {
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';

    await reconcileReminder(scheduler, basePrefs({ enabled: false }), NOW, EN_COPY);

    expect(scheduler.scheduleCallCount).toBe(0);
    expect(scheduler.lastContent).toBeNull();
  });
});
