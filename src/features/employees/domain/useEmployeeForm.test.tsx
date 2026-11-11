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
      receiptEncryptionEnabled: false,
      receiptPasswordOverride: null,
      receiptFileNameFormat: null,
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
    const target: Employee = makeEmployee({
      id: 'employee-fake-target',
      name: 'Empleado Original',
    });
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
      receiptEncryptionEnabled: false,
      receiptPasswordOverride: null,
      receiptFileNameFormat: null,
    });
  });

  it('seeds alta/baja from the employee on edit and includes them on submit', async () => {
    const target: Employee = makeEmployee({
      id: 'employee-fake-target',
      name: 'Empleado Original',
      altaDate: '2026-07-23',
    });
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
      receiptEncryptionEnabled: false,
      receiptPasswordOverride: null,
      receiptFileNameFormat: null,
    });
  });

  it('surfaces errors and does not call update() on invalid input (edit mode)', async () => {
    const target: Employee = makeEmployee({
      id: 'employee-fake-target',
      name: 'Empleado Original',
    });
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
    const employeeWithGroup = (grupoCotizacion: string | null): Employee =>
      makeEmployee({
        id: 'employee-fake-target',
        name: 'Empleado Original',
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

  describe('receipt file name format', () => {
    it('seeds "inherit the general setting" (null) on create and submits it as null', async () => {
      const repository = new InMemoryEmployeeRepository([]);
      const createSpy = jest.spyOn(repository, 'create');
      const harness = await renderUseEmployeeForm({ kind: 'create' }, repository);

      expect(harness.current.values.receiptFileNameFormat).toBeNull();

      await act(async () => {
        harness.current.setField('name', 'Empleado Nuevo');
        harness.current.setField('baseGross', '900');
      });
      await act(async () => {
        await harness.current.submit();
      });

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ receiptFileNameFormat: null }));
    });

    it('creates an employee with the format chosen in the form', async () => {
      const repository = new InMemoryEmployeeRepository([]);
      const createSpy = jest.spyOn(repository, 'create');
      const harness = await renderUseEmployeeForm({ kind: 'create' }, repository);

      await act(async () => {
        harness.current.setField('name', 'Empleado Nuevo');
        harness.current.setField('baseGross', '900');
        harness.current.setField('receiptFileNameFormat', 'month-year');
      });
      await act(async () => {
        await harness.current.submit();
      });

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ receiptFileNameFormat: 'month-year' }));
    });

    it('seeds a stored "auto" on edit and saves the format chosen afterwards', async () => {
      const target = makeEmployee({ receiptFileNameFormat: 'auto' });
      const repository = new InMemoryEmployeeRepository([target]);
      const updateSpy = jest.spyOn(repository, 'update');
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      expect(harness.current.values.receiptFileNameFormat).toBe('auto');

      await act(async () => {
        harness.current.setField('receiptFileNameFormat', 'name-year-month');
      });
      await act(async () => {
        await harness.current.submit();
      });

      expect(updateSpy).toHaveBeenCalledWith(
        target.id,
        expect.objectContaining({ receiptFileNameFormat: 'name-year-month' }),
      );
      expect((await repository.getById(target.id))?.receiptFileNameFormat).toBe('name-year-month');
    });

    it('goes back to inheriting the general setting when the user picks it again', async () => {
      const target = makeEmployee({ receiptFileNameFormat: 'year-month-name' });
      const repository = new InMemoryEmployeeRepository([target]);
      const updateSpy = jest.spyOn(repository, 'update');
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      expect(harness.current.values.receiptFileNameFormat).toBe('year-month-name');

      await act(async () => {
        harness.current.setField('receiptFileNameFormat', null);
      });
      await act(async () => {
        await harness.current.submit();
      });

      expect(updateSpy).toHaveBeenCalledWith(target.id, expect.objectContaining({ receiptFileNameFormat: null }));
      expect((await repository.getById(target.id))?.receiptFileNameFormat).toBeNull();
    });

    it('keeps an untouched stored format on save', async () => {
      const target = makeEmployee({ receiptFileNameFormat: 'auto' });
      const repository = new InMemoryEmployeeRepository([target]);
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      await act(async () => {
        await harness.current.submit();
      });

      expect((await repository.getById(target.id))?.receiptFileNameFormat).toBe('auto');
    });
  });

  describe('receipt protection', () => {
    async function submitted(harness: Awaited<ReturnType<typeof renderUseEmployeeForm>>): Promise<boolean> {
      let success = false;
      await act(async () => {
        success = await harness.current.submit();
      });
      return success;
    }

    it('seeds the protection fields as off and empty on create', async () => {
      const harness = await renderUseEmployeeForm({ kind: 'create' }, new InMemoryEmployeeRepository([]));

      expect(harness.current.values.receiptEncryptionEnabled).toBe(false);
      expect(harness.current.values.receiptPasswordOverride).toBe('');
    });

    it('seeds the protection fields from the employee on edit', async () => {
      const target = makeEmployee({
        nif: '00000000T',
        receiptEncryptionEnabled: true,
        receiptPasswordOverride: 'clave 1',
      });
      const harness = await renderUseEmployeeForm(
        { kind: 'edit', employee: target },
        new InMemoryEmployeeRepository([target]),
      );

      expect(harness.current.values.receiptEncryptionEnabled).toBe(true);
      expect(harness.current.values.receiptPasswordOverride).toBe('clave 1');
    });

    it('seeds an empty own password when the employee has none', async () => {
      const target = makeEmployee({ receiptPasswordOverride: null });
      const harness = await renderUseEmployeeForm(
        { kind: 'edit', employee: target },
        new InMemoryEmployeeRepository([target]),
      );

      expect(harness.current.values.receiptPasswordOverride).toBe('');
    });

    it('creates an employee with the protection on and the NIF/NIE as the password source', async () => {
      const repository = new InMemoryEmployeeRepository([]);
      const createSpy = jest.spyOn(repository, 'create');
      const harness = await renderUseEmployeeForm({ kind: 'create' }, repository);

      await act(async () => {
        harness.current.setField('name', 'Empleado Nuevo');
        harness.current.setField('baseGross', '900');
        harness.current.setField('nif', '00000000T');
        harness.current.setField('receiptEncryptionEnabled', true);
      });

      expect(await submitted(harness)).toBe(true);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nif: '00000000T',
          receiptEncryptionEnabled: true,
          receiptPasswordOverride: null,
        }),
      );
    });

    it('blocks the save and does not call create() when the protection is on without any password source', async () => {
      const repository = new InMemoryEmployeeRepository([]);
      const createSpy = jest.spyOn(repository, 'create');
      const harness = await renderUseEmployeeForm({ kind: 'create' }, repository);

      await act(async () => {
        harness.current.setField('name', 'Empleado Nuevo');
        harness.current.setField('baseGross', '900');
        harness.current.setField('receiptEncryptionEnabled', true);
      });

      expect(await submitted(harness)).toBe(false);
      expect(harness.current.errors).toEqual({ receiptEncryptionEnabled: 'password_unavailable' });
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('persists a new own password on edit', async () => {
      const target = makeEmployee({ nif: '00000000T' });
      const repository = new InMemoryEmployeeRepository([target]);
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      await act(async () => {
        harness.current.setField('receiptPasswordOverride', ' clave 1 ');
        harness.current.setField('receiptEncryptionEnabled', true);
      });

      expect(await submitted(harness)).toBe(true);
      const stored = await repository.getById(target.id);
      expect(stored?.receiptEncryptionEnabled).toBe(true);
      expect(stored?.receiptPasswordOverride).toBe('clave 1');
    });

    it('clears the stored own password when the input is emptied', async () => {
      const target = makeEmployee({ nif: '00000000T', receiptPasswordOverride: 'clave 1' });
      const repository = new InMemoryEmployeeRepository([target]);
      const updateSpy = jest.spyOn(repository, 'update');
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      await act(async () => {
        harness.current.setField('receiptPasswordOverride', '');
      });

      expect(await submitted(harness)).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        target.id,
        expect.objectContaining({ receiptPasswordOverride: null }),
      );
      const stored = await repository.getById(target.id);
      expect(stored?.receiptPasswordOverride).toBeNull();
    });

    it('keeps the own password stored when only the protection is switched off', async () => {
      const target = makeEmployee({
        receiptEncryptionEnabled: true,
        receiptPasswordOverride: 'clave 1',
      });
      const repository = new InMemoryEmployeeRepository([target]);
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      await act(async () => {
        harness.current.setField('receiptEncryptionEnabled', false);
      });

      expect(await submitted(harness)).toBe(true);
      const stored = await repository.getById(target.id);
      expect(stored?.receiptEncryptionEnabled).toBe(false);
      expect(stored?.receiptPasswordOverride).toBe('clave 1');
    });

    it('blocks saving when the NIF/NIE and the own password of a protected employee are both cleared', async () => {
      const target = makeEmployee({ nif: '00000000T', receiptEncryptionEnabled: true });
      const repository = new InMemoryEmployeeRepository([target]);
      const updateSpy = jest.spyOn(repository, 'update');
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      await act(async () => {
        harness.current.setField('nif', '');
      });

      expect(await submitted(harness)).toBe(false);
      expect(harness.current.errors).toEqual({ receiptEncryptionEnabled: 'password_unavailable' });
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('rejects an own password the receipt writer could not encode', async () => {
      const target = makeEmployee({ nif: '00000000T' });
      const repository = new InMemoryEmployeeRepository([target]);
      const updateSpy = jest.spyOn(repository, 'update');
      const harness = await renderUseEmployeeForm({ kind: 'edit', employee: target }, repository);

      await act(async () => {
        harness.current.setField('receiptPasswordOverride', 'contraseña');
      });

      expect(await submitted(harness)).toBe(false);
      expect(harness.current.errors).toEqual({ receiptPasswordOverride: 'invalid_characters' });
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  it('exposes a save_failed code with the technical detail when the repository rejects', async () => {
    const repository = new InMemoryEmployeeRepository([]);
    jest.spyOn(repository, 'create').mockRejectedValueOnce(new Error('disk full'));
    const harness = await renderUseEmployeeForm({ kind: 'create' }, repository);

    await act(async () => {
      harness.current.setField('name', 'Empleado Nuevo');
      harness.current.setField('baseGross', '900');
    });

    let success = true;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(false);
    expect(harness.current.saveError).toEqual({ code: 'save_failed', detail: 'disk full' });
    expect(harness.current.saving).toBe(false);
  });
});
