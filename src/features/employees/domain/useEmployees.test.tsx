/**
 * Render test for `useEmployees` (design ADR-1 / task 2.4): active-only
 * filtering, `refresh` re-reading, and `deactivate` soft-deleting, exercised
 * against `InMemoryEmployeeRepository` + `InMemoryEmployerRepository`
 * through the same provider-injection pattern as `SmokeScreen.test.tsx`.
 */

import { act, create } from 'react-test-renderer';

import { CurrentEmployerProvider, RepositoryProvider, type Repositories } from '@/core';
import type { Employee, PayrollRunRepository, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { useEmployees, type UseEmployeesResult } from './useEmployees';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '../testing/fakes';
import { FAKE_EMPLOYER, makeEmployee } from '../testing/fixtures';

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

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

function HookHarness({ onResult }: { onResult: (result: UseEmployeesResult) => void }) {
  const result = useEmployees();
  onResult(result);
  return null;
}

async function renderUseEmployees(employeeRepository: InMemoryEmployeeRepository) {
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([FAKE_EMPLOYER]),
    employees: employeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let latest!: UseEmployeesResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <HookHarness onResult={(result) => (latest = result)} />
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  // Flush bootstrap + initial load microtasks.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get current(): UseEmployeesResult {
      return latest;
    },
  };
}

describe('useEmployees', () => {
  it('only returns active employees', async () => {
    const active: Employee = makeEmployee({
      id: 'employee-fake-active',
      name: 'Empleada Activa',
    });
    const inactive: Employee = { ...active, id: 'employee-fake-inactive', active: false };
    const repository = new InMemoryEmployeeRepository([active, inactive]);

    const harness = await renderUseEmployees(repository);

    expect(harness.current.employees.map((employee) => employee.id)).toEqual(['employee-fake-active']);
    expect(harness.current.loading).toBe(false);
    expect(harness.current.error).toBeNull();
  });

  it('re-reads the repository on refresh', async () => {
    const repository = new InMemoryEmployeeRepository([]);
    const harness = await renderUseEmployees(repository);

    expect(harness.current.employees).toEqual([]);

    await repository.create({
      employerId: FAKE_EMPLOYER.id,
      name: 'Empleado Nuevo',
      baseGrossCents: cents(90000),
    });

    await act(async () => {
      await harness.current.refresh();
    });

    expect(harness.current.employees).toHaveLength(1);
  });

  it('deactivate soft-deletes via update({active:false}) and refreshes', async () => {
    const target: Employee = makeEmployee({
      id: 'employee-fake-target',
      name: 'Empleado A Eliminar',
    });
    const repository = new InMemoryEmployeeRepository([target]);
    const harness = await renderUseEmployees(repository);

    expect(harness.current.employees).toHaveLength(1);

    await act(async () => {
      await harness.current.deactivate(target.id);
    });

    expect(harness.current.employees).toHaveLength(0);
    const stored = await repository.getById(target.id);
    expect(stored?.active).toBe(false);
  });

  it('exposes a read_failed code with the technical detail when the list read rejects', async () => {
    const repository = new InMemoryEmployeeRepository([]);
    jest.spyOn(repository, 'list').mockRejectedValue(new Error('disk read failure'));

    const harness = await renderUseEmployees(repository);

    expect(harness.current.error).toEqual({ code: 'read_failed', detail: 'disk read failure' });
    expect(harness.current.loading).toBe(false);
  });
});
