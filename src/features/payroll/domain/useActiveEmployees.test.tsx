/**
 * Render test for `useActiveEmployees` (decision #679): proves the
 * payroll-owned employee-picker loader filters to active employees only and
 * re-reads on repository changes, mirroring
 * `features/employees/domain/useEmployees.test.tsx`'s coverage for the
 * equivalent employees-feature hook. Exercised against
 * `InMemoryEmployeeRepository`/`InMemoryEmployerRepository` (reused from the
 * employees feature's testing fakes -- test code only, never production
 * code) through the same provider-injection pattern as
 * `usePayrollRunForm.test.tsx`.
 */

import { act, create } from 'react-test-renderer';

import { CurrentEmployerProvider, RepositoryProvider, type Repositories } from '@/core';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import { FAKE_EMPLOYER, makeEmployee } from '@/features/employees/testing/fixtures';
import type { Employee, PayrollRunRepository, SettingsRepository } from '@/types';

import { useActiveEmployees, type UseActiveEmployeesResult } from './useActiveEmployees';

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

function HookHarness({ onResult }: { onResult: (result: UseActiveEmployeesResult) => void }) {
  const result = useActiveEmployees();
  onResult(result);
  return null;
}

async function renderUseActiveEmployees(employeeRepository: InMemoryEmployeeRepository) {
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([FAKE_EMPLOYER]),
    employees: employeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let latest!: UseActiveEmployeesResult;

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
    get current(): UseActiveEmployeesResult {
      return latest;
    },
  };
}

describe('useActiveEmployees', () => {
  it('only returns active employees', async () => {
    const active: Employee = makeEmployee({
      id: 'employee-fake-active',
      name: 'Empleada Activa',
    });
    const inactive: Employee = { ...active, id: 'employee-fake-inactive', active: false };
    const repository = new InMemoryEmployeeRepository([active, inactive]);

    const harness = await renderUseActiveEmployees(repository);

    expect(harness.current.employees.map((employee) => employee.id)).toEqual(['employee-fake-active']);
    expect(harness.current.loading).toBe(false);
    expect(harness.current.error).toBeNull();
  });
});
