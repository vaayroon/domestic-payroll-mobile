/**
 * Render test for `useReminderSettings`: seeds defaults on first load,
 * edits form fields, and on submit persists via `SettingsRepository` +
 * reconciles the schedule through the `FakeNotificationScheduler` -- mirrors
 * `useEmployerForm.test.tsx`'s provider-injection pattern.
 */

import { act, create } from 'react-test-renderer';

import { NotifyServiceProvider, RepositoryProvider, type Repositories } from '@/core';
import { FakeNotificationScheduler } from '@/services/notify/testing/fakes';
import type { AppSetting, EmployeeRepository, EmployerRepository, PayrollRunRepository, SettingsRepository } from '@/types';

import { useReminderSettings, type UseReminderSettingsResult } from './useReminderSettings';

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

class InMemorySettingsRepository implements SettingsRepository {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<AppSetting> {
    this.store.set(key, value);
    return { key, value };
  }
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

function FormHarness({ onResult }: { onResult: (result: UseReminderSettingsResult) => void }) {
  const result = useReminderSettings();
  onResult(result);
  return null;
}

async function renderUseReminderSettings(settings: SettingsRepository, scheduler: FakeNotificationScheduler) {
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: fakeEmployeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings,
  };

  let latest!: UseReminderSettingsResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <NotifyServiceProvider scheduler={scheduler}>
          <FormHarness onResult={(result) => (latest = result)} />
        </NotifyServiceProvider>
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get current(): UseReminderSettingsResult {
      return latest;
    },
  };
}

describe('useReminderSettings', () => {
  it('seeds the opt-in default when nothing is persisted', async () => {
    const harness = await renderUseReminderSettings(new InMemorySettingsRepository(), new FakeNotificationScheduler());

    expect(harness.current.loading).toBe(false);
    expect(harness.current.values).toEqual({ enabled: false, dayOfMonth: 1, hour: 9, minute: 0 });
    expect(harness.current.permissionDenied).toBe(false);
  });

  it('enabling, editing fields, and saving persists prefs and reconciles the schedule', async () => {
    const settings = new InMemorySettingsRepository();
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';
    const harness = await renderUseReminderSettings(settings, scheduler);

    await act(async () => {
      harness.current.setEnabled(true);
      harness.current.setDayOfMonth(15);
      harness.current.setHour(20);
      harness.current.setMinute(30);
    });

    let success = false;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(true);
    expect(await settings.get('reminder.preferences')).toBe(
      JSON.stringify({ enabled: true, dayOfMonth: 15, hour: 20, minute: 30 }),
    );
    expect(scheduler.channelEnsured).toBe(true);
    expect(scheduler.scheduleCallCount).toBe(1);
    expect(harness.current.permissionDenied).toBe(false);
  });

  it('surfaces the denied banner when permission is refused, but still persists the choice', async () => {
    const settings = new InMemorySettingsRepository();
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'denied';
    const harness = await renderUseReminderSettings(settings, scheduler);

    await act(async () => {
      harness.current.setEnabled(true);
    });

    let success = false;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(true);
    expect(harness.current.permissionDenied).toBe(true);
    expect(scheduler.scheduleCallCount).toBe(0);
    expect(await settings.get('reminder.preferences')).not.toBeNull();
  });

  it('disabling and saving cancels the scheduled reminder', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set('reminder.preferences', JSON.stringify({ enabled: true, dayOfMonth: 5, hour: 9, minute: 0 }));
    const scheduler = new FakeNotificationScheduler();
    scheduler.permissionStatus = 'granted';
    const harness = await renderUseReminderSettings(settings, scheduler);

    expect(harness.current.values.enabled).toBe(true);

    await act(async () => {
      harness.current.setEnabled(false);
    });

    await act(async () => {
      await harness.current.submit();
    });

    expect(scheduler.cancelled).toBe(true);
    expect(scheduler.scheduleCallCount).toBe(0);
  });
});
