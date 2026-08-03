/**
 * Render test for `CurrentEmployerProvider` (design ADR-2 / task 2.2): proves
 * the bootstrap is idempotent — first launch creates exactly one employer,
 * a repeated mount against a repository that already has one does not create
 * a second — using the same in-memory fake + `RepositoryProvider` injection
 * pattern as `SmokeScreen.test.tsx`.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import type { Employee, EmployeeRepository, Employer, PayrollRunRepository, SettingsRepository } from '@/types';

import { CurrentEmployerProvider, useCurrentEmployerId } from './currentEmployer';
import { InMemoryEmployerRepository } from '../testing/fakes';

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

const fakeEmployeeRepository: EmployeeRepository = {
  list: async () => [] as Employee[],
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

const fakeSettingsRepository: SettingsRepository = {
  get: notImplemented('SettingsRepository.get'),
  set: notImplemented('SettingsRepository.set'),
};

function EmployerIdProbe() {
  const employerId = useCurrentEmployerId();
  return <Text testID="employer-id">{employerId}</Text>;
}

async function renderWithEmployers(employers: Employer[]): Promise<{
  renderer: ReactTestRenderer;
  repository: InMemoryEmployerRepository;
}> {
  const repository = new InMemoryEmployerRepository(employers);
  const repositories: Repositories = {
    employers: repository,
    employees: fakeEmployeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <EmployerIdProbe />
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return { renderer, repository };
}

describe('CurrentEmployerProvider', () => {
  it('creates exactly one employer on first launch', async () => {
    const { renderer, repository } = await renderWithEmployers([]);

    const probe = renderer.root.findByProps({ testID: 'employer-id' });
    expect(typeof probe.props.children).toBe('string');

    const all = await repository.list();
    expect(all).toHaveLength(1);
  });

  it('does not create a second employer when one already exists', async () => {
    const seedEmployer: Employer = {
      id: 'employer-fake-seed',
      name: 'Empleador',
      nif: null,
      address: null,
      createdAt: 0,
    };

    const { renderer, repository } = await renderWithEmployers([seedEmployer]);

    const probe = renderer.root.findByProps({ testID: 'employer-id' });
    expect(probe.props.children).toBe('employer-fake-seed');

    const all = await repository.list();
    expect(all).toHaveLength(1);
  });
});
