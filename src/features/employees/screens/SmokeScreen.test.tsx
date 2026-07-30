/**
 * Render test for the Foundation smoke screen — proves the component tree
 * mounts, NativeWind `className`s are attached to native elements, and the
 * `SettingsRepository` round-trip drives the pass/fail indicator correctly.
 *
 * This test injects an in-memory fake `SettingsRepository` through
 * `RepositoryProvider` (the same DI boundary the real app uses) instead of a
 * live `expo-sqlite` connection — the native SQLite module cannot run under
 * `jest-expo` headless (confirmed empirically in the Phase 3 apply batch, see
 * `sdd/foundation/apply-progress` Learned #1). The real device-backed
 * round-trip is verified manually (see the apply report's boot checklist),
 * not here.
 */

import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import type { EmployeeRepository, EmployerRepository, PayrollRunRepository, SettingsRepository } from '@/types';

import { SmokeScreen } from './SmokeScreen';

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

function createInMemorySettingsRepository(): SettingsRepository {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
      return { key, value };
    },
  };
}

async function renderSmokeScreen(settings: SettingsRepository): Promise<ReactTestRenderer> {
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: fakeEmployeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <SmokeScreen />
      </RepositoryProvider>,
    );
  });
  // Flush the microtasks queued by the round-trip's two sequential awaits
  // (`settings.set` then `settings.get`) so the resulting state update commits
  // before assertions run.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return renderer;
}

describe('SmokeScreen', () => {
  it('applies NativeWind classes to the root view', async () => {
    const renderer = await renderSmokeScreen(createInMemorySettingsRepository());

    const rootView = renderer.root.findAllByType(View)[0];
    expect(rootView?.props.className).toContain('flex-1');
  });

  it('shows PASS and the round-tripped value once the settings round-trip succeeds', async () => {
    const renderer = await renderSmokeScreen(createInMemorySettingsRepository());

    const status = renderer.root.findByProps({ testID: 'smoke-status' });
    expect(status.props.children).toBe('PASS');

    const value = renderer.root.findByProps({ testID: 'smoke-value' });
    expect(String(value.props.children)).toContain('Round-tripped value:');
  });

  it('shows FAIL when the settings repository throws', async () => {
    const failingSettings: SettingsRepository = {
      get: notImplemented('SettingsRepository.get'),
      set: async () => {
        throw new Error('boom');
      },
    };

    const renderer = await renderSmokeScreen(failingSettings);

    const status = renderer.root.findByProps({ testID: 'smoke-status' });
    expect(status.props.children).toBe('FAIL');

    const error = renderer.root.findByProps({ testID: 'smoke-error' });
    expect(String(error.props.children)).toContain('boom');
  });
});
