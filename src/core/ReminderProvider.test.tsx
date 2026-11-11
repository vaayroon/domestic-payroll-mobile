/**
 * Render test for `ReminderProvider` (spec TN-1/TN-2, verify-report CRITICAL
 * finding): proves that a live notification tap navigates to `/payroll/new`
 * and re-reconciles the reminder — using the existing `FakeNotificationScheduler`
 * test double (`simulateTap()`) that was built for this purpose but was
 * previously unused. TN-3 (cold-start tap) is device-QA-only per spec and is
 * intentionally NOT exercised here.
 *
 * Mirrors `EmployerSettingsScreen.test.tsx`'s `useRouter` mock pattern
 * (`assertIsReady` throws outside a live navigation tree) and
 * `CurrentEmployerProvider.test.tsx`'s in-memory-fake + provider-injection
 * harness.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { i18n } from '@/core/i18n';
import { NotifyServiceProvider, RepositoryProvider, type Repositories } from '@/core';
import { serializeReminderPreferences, type ReminderPreferences } from '@/features/reminder';
import { FakeNotificationScheduler } from '@/services/notify/testing/fakes';
import type { EmployeeRepository, EmployerRepository, PayrollRunRepository, SettingsRepository } from '@/types';

import { ReminderProvider } from './ReminderProvider';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockRouterPush }),
}));

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

const fakeEmployerRepository: EmployerRepository = {
  list: notImplemented('EmployerRepository.list'),
  getById: notImplemented('EmployerRepository.getById'),
  create: notImplemented('EmployerRepository.create'),
  update: notImplemented('EmployerRepository.update'),
  remove: notImplemented('EmployerRepository.remove'),
};

const fakeEmployeeRepository: EmployeeRepository = {
  list: notImplemented('EmployeeRepository.list'),
  getById: notImplemented('EmployeeRepository.getById'),
  create: notImplemented('EmployeeRepository.create'),
  update: notImplemented('EmployeeRepository.update'),
  remove: notImplemented('EmployeeRepository.remove'),
};

const fakePayrollRunRepository: PayrollRunRepository = {
  listByEmployee: notImplemented('PayrollRunRepository.listByEmployee'),
  getByPeriod: notImplemented('PayrollRunRepository.getByPeriod'),
  create: notImplemented('PayrollRunRepository.create'),
  remove: notImplemented('PayrollRunRepository.remove'),
};

/** Lets queued promise callbacks (settings read, reconcile steps) run to completion. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

const ENABLED_PREFS: ReminderPreferences = { enabled: true, dayOfMonth: 5, hour: 9, minute: 0 };

/** Renders `ReminderProvider` with a granted, enabled scheduler and flushes its mount-time reconcile. */
async function renderProvider(
  prefs: ReminderPreferences = ENABLED_PREFS,
): Promise<{ renderer: ReactTestRenderer; scheduler: FakeNotificationScheduler }> {
  const scheduler = new FakeNotificationScheduler();
  scheduler.permissionStatus = 'granted';

  const settingsRepository: SettingsRepository = {
    get: async () => serializeReminderPreferences(prefs),
    set: notImplemented('SettingsRepository.set'),
  };
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: fakeEmployeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings: settingsRepository,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <NotifyServiceProvider scheduler={scheduler}>
          <ReminderProvider>
            <Text>probe</Text>
          </ReminderProvider>
        </NotifyServiceProvider>
      </RepositoryProvider>,
    );
  });
  // Flush the mount-time `consumeStartupTap()` + `reconcile()` microtasks.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return { renderer, scheduler };
}

describe('ReminderProvider', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
  });

  it('TN-1: a live notification tap navigates to /payroll/new', async () => {
    const { scheduler } = await renderProvider();

    await act(async () => {
      scheduler.simulateTap();
      await Promise.resolve();
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/payroll/new');
  });

  it('TN-2: a live notification tap reschedules the reminder', async () => {
    const { scheduler } = await renderProvider();
    const scheduleCallCountAfterMount = scheduler.scheduleCallCount;
    expect(scheduleCallCountAfterMount).toBeGreaterThan(0); // mount-time reconcile already scheduled once.

    await act(async () => {
      scheduler.simulateTap();
      await Promise.resolve();
    });

    expect(scheduler.scheduleCallCount).toBeGreaterThan(scheduleCallCountAfterMount);
  });

  it('does not navigate when no tap occurs (no false positive)', async () => {
    await renderProvider();

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  describe('notification copy follows the UI language', () => {
    it('schedules Spanish copy when the UI is Spanish', async () => {
      const { scheduler } = await renderProvider();

      expect(scheduler.lastChannelName).toBe('Recordatorio de nómina');
      expect(scheduler.lastContent).toEqual({
        title: 'Recordatorio de nómina',
        body: 'Es hora de generar la nómina de este mes.',
      });
    });

    it('schedules English copy when the UI is English', async () => {
      await act(async () => {
        await i18n.changeLanguage('en');
      });

      const { scheduler } = await renderProvider();

      expect(scheduler.lastChannelName).toBe('Payroll reminder');
      expect(scheduler.lastContent).toEqual({
        title: 'Payroll reminder',
        body: "It's time to run this month's payroll.",
      });
    });

    it('reschedules with English copy and renames the channel when the language switches ES -> EN', async () => {
      const { scheduler } = await renderProvider();
      const callsBefore = scheduler.scheduleCallCount;

      await act(async () => {
        await i18n.changeLanguage('en');
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(scheduler.scheduleCallCount).toBe(callsBefore + 1);
      expect(scheduler.lastChannelName).toBe('Payroll reminder');
      expect(scheduler.lastContent?.title).toBe('Payroll reminder');
    });

    it('ends on the new-language copy when an old-language reconcile is still in flight at the switch', async () => {
      const { scheduler } = await renderProvider();

      // A tap starts a Spanish reconcile; hold it inside `scheduleReminder`.
      const releaseSpanishSchedule = scheduler.holdNextSchedule();
      await act(async () => {
        scheduler.simulateTap();
        await flushMicrotasks();
      });

      // Switch to English while the Spanish run is still pending.
      await act(async () => {
        await i18n.changeLanguage('en');
        await flushMicrotasks();
      });

      // The Spanish run finishes last in wall-clock terms...
      await act(async () => {
        releaseSpanishSchedule();
        await flushMicrotasks();
      });

      // ...but the schedule must still end in English.
      expect(scheduler.lastContent?.title).toBe('Payroll reminder');
      expect(scheduler.lastChannelName).toBe('Payroll reminder');
    });

    it('schedules nothing on a language switch while the reminder is disabled', async () => {
      const { scheduler } = await renderProvider({ ...ENABLED_PREFS, enabled: false });

      await act(async () => {
        await i18n.changeLanguage('en');
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(scheduler.scheduleCallCount).toBe(0);
      expect(scheduler.lastContent).toBeNull();
    });
  });
});
