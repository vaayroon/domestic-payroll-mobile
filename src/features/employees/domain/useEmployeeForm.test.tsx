/**
 * Render test for `useEmployeeForm`'s submit path (verify-report #660, W1):
 * valid input calls the correct repository method (create vs. update) with
 * the exact value `validateEmployeeForm` produces; invalid input surfaces
 * `errors` and never reaches the repository. Exercised against
 * `InMemoryEmployeeRepository` + `InMemoryEmployerRepository` through the
 * same provider-injection pattern as `useEmployees.test.tsx`.
 */

import { act, create } from 'react-test-renderer';

import { CurrentEmployerProvider, RepositoryProvider, type Repositories } from '@/core';
import type { Employee, PayrollRunRepository, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { useEmployeeForm, type EmployeeFormMode, type UseEmployeeFormResult } from './useEmployeeForm';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '../testing/fakes';
import { FAKE_EMPLOYER } from '../testing/fixtures';

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
      contractType: 'INDEFINIDO',
      grupoCotizacion: null,
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
      contractType: 'INDEFINIDO',
      grupoCotizacion: null,
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
      contractType: 'INDEFINIDO',
      grupoCotizacion: null,
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
      contractType: 'INDEFINIDO',
      grupoCotizacion: null,
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
      contractType: 'INDEFINIDO',
      grupoCotizacion: null,
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
      contractType: 'INDEFINIDO',
      grupoCotizacion: null,
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

  describe('grupoCotizacion', () => {
    const employeeWithGroup = (grupoCotizacion: string | null): Employee => ({
      id: 'employee-fake-target',
      employerId: FAKE_EMPLOYER.id,
      name: 'Empleado Original',
      nif: null,
      naf: null,
      baseGrossCents: cents(90000),
      active: true,
      altaDate: null,
      bajaDate: null,
      contractType: 'INDEFINIDO',
      grupoCotizacion,
    });

    it('seeds a null group as an empty field and submits it back as null', async () => {
      const target = employeeWithGroup(null);
      const repository = new InMemoryEmployeeRepository([target]);
      const updateSpy = jest.spyOn(repository, 'update');
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      expect(harness.current.values.grupoCotizacion).toBe('');

      await act(async () => {
        await harness.current.submit();
      });

      expect(updateSpy).toHaveBeenCalledWith(
        target.id,
        expect.objectContaining({ grupoCotizacion: null }),
      );
    });

    it('seeds a stored group and submits it back unchanged', async () => {
      const target = employeeWithGroup('7');
      const repository = new InMemoryEmployeeRepository([target]);
      const updateSpy = jest.spyOn(repository, 'update');
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      expect(harness.current.values.grupoCotizacion).toBe('7');

      await act(async () => {
        await harness.current.submit();
      });

      expect(updateSpy).toHaveBeenCalledWith(
        target.id,
        expect.objectContaining({ grupoCotizacion: '7' }),
      );
    });

    it('clears the stored group when the user empties the field', async () => {
      const target = employeeWithGroup('7');
      const repository = new InMemoryEmployeeRepository([target]);
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      await act(async () => {
        harness.current.setField('grupoCotizacion', '');
      });
      await act(async () => {
        await harness.current.submit();
      });

      expect((await repository.getById(target.id))?.grupoCotizacion).toBeNull();
    });

    it('starts empty on create and never invents a default group', async () => {
      const repository = new InMemoryEmployeeRepository([]);
      const createSpy = jest.spyOn(repository, 'create');
      const harness = await renderUseEmployeeForm({ kind: 'create' }, repository);

      expect(harness.current.values.grupoCotizacion).toBe('');

      await act(async () => {
        harness.current.setField('name', 'Empleado Nuevo');
        harness.current.setField('baseGross', '900');
      });
      await act(async () => {
        await harness.current.submit();
      });

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ grupoCotizacion: null }));
    });

    it('surfaces too_long and does not reach the repository for an over-long group', async () => {
      const target = employeeWithGroup(null);
      const repository = new InMemoryEmployeeRepository([target]);
      const updateSpy = jest.spyOn(repository, 'update');
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      await act(async () => {
        harness.current.setField('grupoCotizacion', 'x'.repeat(41));
      });
      await act(async () => {
        await harness.current.submit();
      });

      expect(harness.current.errors).toEqual({ grupoCotizacion: 'too_long' });
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });
});
