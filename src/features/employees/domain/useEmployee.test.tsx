/**
 * Render test for `useEmployee` (verify-report #660, W1): loads an employee
 * by id via `getById`, exposes the initial `loading` state, and resolves to
 * `employee: null` (not an error) when no row matches — the "Empleado no
 * encontrado" copy lives in `EmployeeEditScreen`, not the hook.
 */

import { act, create } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import type { Employee, EmployeeRepository, EmployerRepository, PayrollRunRepository, SettingsRepository } from '@/types';

import { useEmployee, type UseEmployeeResult } from './useEmployee';
import { makeEmployee } from '../testing/fixtures';

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

function EmployeeHarness({ id, onResult }: { id: string; onResult: (result: UseEmployeeResult) => void }) {
  const result = useEmployee(id);
  onResult(result);
  return null;
}

async function renderUseEmployee(id: string, employeeRepository: EmployeeRepository): Promise<UseEmployeeResult[]> {
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: employeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings: fakeSettingsRepository,
  };

  const snapshots: UseEmployeeResult[] = [];

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <EmployeeHarness id={id} onResult={(result) => snapshots.push(result)} />
      </RepositoryProvider>,
    );
  });
  // Flush the microtask queued by the loader's single `await getById(id)`.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return snapshots;
}

describe('useEmployee', () => {
  it('starts in a loading state before the repository resolves', async () => {
    const target: Employee = makeEmployee({
      id: 'employee-fake-target',
      employerId: 'employer-fake-seed',
      name: 'Empleado de Prueba',
    });
    const employeeRepository: EmployeeRepository = {
      list: notImplemented('EmployeeRepository.list'),
      getById: async () => target,
      create: notImplemented('EmployeeRepository.create'),
      update: notImplemented('EmployeeRepository.update'),
      remove: notImplemented('EmployeeRepository.remove'),
    };

    const snapshots = await renderUseEmployee(target.id, employeeRepository);

    expect(snapshots[0]).toEqual({ employee: null, loading: true, error: null });
  });

  it('loads the employee by id and resolves loading to false', async () => {
    const target: Employee = makeEmployee({
      id: 'employee-fake-target',
      employerId: 'employer-fake-seed',
      name: 'Empleado de Prueba',
    });
    const employeeRepository: EmployeeRepository = {
      list: notImplemented('EmployeeRepository.list'),
      getById: async (id) => (id === target.id ? target : null),
      create: notImplemented('EmployeeRepository.create'),
      update: notImplemented('EmployeeRepository.update'),
      remove: notImplemented('EmployeeRepository.remove'),
    };

    const snapshots = await renderUseEmployee(target.id, employeeRepository);
    const last = snapshots[snapshots.length - 1];

    expect(last).toEqual({ employee: target, loading: false, error: null });
  });

  it('resolves employee: null (not an error) when no row matches', async () => {
    const employeeRepository: EmployeeRepository = {
      list: notImplemented('EmployeeRepository.list'),
      getById: async () => null,
      create: notImplemented('EmployeeRepository.create'),
      update: notImplemented('EmployeeRepository.update'),
      remove: notImplemented('EmployeeRepository.remove'),
    };

    const snapshots = await renderUseEmployee('employee-fake-missing', employeeRepository);
    const last = snapshots[snapshots.length - 1];

    expect(last).toEqual({ employee: null, loading: false, error: null });
  });
});
