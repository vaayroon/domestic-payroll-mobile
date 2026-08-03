/**
 * Render test for `useEmployeeForm`'s submit path (verify-report #660, W1):
 * valid input calls the correct repository method (create vs. update) with
 * the exact value `validateEmployeeForm` produces; invalid input surfaces
 * `errors` and never reaches the repository. Exercised against
 * `InMemoryEmployeeRepository` + `InMemoryEmployerRepository` through the
 * same provider-injection pattern as `useEmployees.test.tsx`.
 */

import { act, create } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import type { Employee, Employer, PayrollRunRepository, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { CurrentEmployerProvider } from './currentEmployer';
import { useEmployeeForm, type EmployeeFormMode, type UseEmployeeFormResult } from './useEmployeeForm';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '../testing/fakes';

// Obviously-fake placeholder identifiers/names only (CLAUDE.md §6).
const FAKE_EMPLOYER: Employer = { id: 'employer-fake-seed', name: 'Empleador', nif: null, address: null, createdAt: 0 };

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

function FormHarness({
  mode,
  onResult,
}: {
  mode: EmployeeFormMode;
  onResult: (result: UseEmployeeFormResult) => void;
}) {
  const result = useEmployeeForm(mode);
  onResult(result);
  return null;
}

async function renderUseEmployeeForm(mode: EmployeeFormMode, employeeRepository: InMemoryEmployeeRepository) {
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([FAKE_EMPLOYER]),
    employees: employeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let latest!: UseEmployeeFormResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <FormHarness mode={mode} onResult={(result) => (latest = result)} />
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  // Flush bootstrap microtasks (CurrentEmployerProvider's list()/create()).
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get current(): UseEmployeeFormResult {
      return latest;
    },
  };
}

describe('useEmployeeForm', () => {
  it('calls create() with the validated NewEmployee on valid input (create mode)', async () => {
    const repository = new InMemoryEmployeeRepository([]);
    const createSpy = jest.spyOn(repository, 'create');
    const harness = await renderUseEmployeeForm({ kind: 'create' }, repository);

    await act(async () => {
      harness.current.setField('name', 'Empleado Nuevo');
      harness.current.setField('baseGross', '900');
    });

    let success = false;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(true);
    expect(createSpy).toHaveBeenCalledWith({
      employerId: FAKE_EMPLOYER.id,
      name: 'Empleado Nuevo',
      nif: null,
      naf: null,
      baseGrossCents: cents(90000),
      altaDate: null,
      bajaDate: null,
    });
    expect(harness.current.errors).toEqual({});
  });

  it('surfaces errors and does not call create() on invalid input (create mode)', async () => {
    const repository = new InMemoryEmployeeRepository([]);
    const createSpy = jest.spyOn(repository, 'create');
    const harness = await renderUseEmployeeForm({ kind: 'create' }, repository);

    await act(async () => {
      harness.current.setField('baseGross', 'abc');
    });

    let success = true;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(false);
    expect(harness.current.errors).toEqual({ name: 'required', baseGross: 'not_a_number' });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('calls update() with the validated patch on valid input (edit mode)', async () => {
    const target: Employee = {
      id: 'employee-fake-target',
      employerId: FAKE_EMPLOYER.id,
      name: 'Empleado Original',
      nif: null,
      naf: null,
      baseGrossCents: cents(90000),
      active: true,
      altaDate: null,
      bajaDate: null,
    };
    const repository = new InMemoryEmployeeRepository([target]);
    const updateSpy = jest.spyOn(repository, 'update');
    const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

    await act(async () => {
      harness.current.setField('name', 'Empleado Actualizado');
    });

    let success = false;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(target.id, {
      employerId: FAKE_EMPLOYER.id,
      name: 'Empleado Actualizado',
      nif: null,
      naf: null,
      baseGrossCents: cents(90000),
      altaDate: null,
      bajaDate: null,
    });
  });

  it('seeds alta/baja from the employee on edit and includes them on submit', async () => {
    const target: Employee = {
      id: 'employee-fake-target',
      employerId: FAKE_EMPLOYER.id,
      name: 'Empleado Original',
      nif: null,
      naf: null,
      baseGrossCents: cents(90000),
      active: true,
      altaDate: '2026-07-23',
      bajaDate: null,
    };
    const repository = new InMemoryEmployeeRepository([target]);
    const updateSpy = jest.spyOn(repository, 'update');
    const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

    expect(harness.current.values.alta).toBe('2026-07-23');
    expect(harness.current.values.baja).toBe('');

    await act(async () => {
      harness.current.setField('baja', '2026-12-31');
    });

    let success = false;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(target.id, {
      employerId: FAKE_EMPLOYER.id,
      name: 'Empleado Original',
      nif: null,
      naf: null,
      baseGrossCents: cents(90000),
      altaDate: '2026-07-23',
      bajaDate: '2026-12-31',
    });
  });

  it('surfaces errors and does not call update() on invalid input (edit mode)', async () => {
    const target: Employee = {
      id: 'employee-fake-target',
      employerId: FAKE_EMPLOYER.id,
      name: 'Empleado Original',
      nif: null,
      naf: null,
      baseGrossCents: cents(90000),
      active: true,
      altaDate: null,
      bajaDate: null,
    };
    const repository = new InMemoryEmployeeRepository([target]);
    const updateSpy = jest.spyOn(repository, 'update');
    const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

    await act(async () => {
      harness.current.setField('name', '   ');
    });

    let success = true;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(false);
    expect(harness.current.errors).toEqual({ name: 'required' });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
