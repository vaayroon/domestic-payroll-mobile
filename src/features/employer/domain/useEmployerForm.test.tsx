/**
 * Render test for `useEmployerForm`: seeds from the current employer
 * (load-by-id), submits via `update()` only (no create mode — design
 * ADR-5), surfaces validation errors without calling the repository, and
 * surfaces save errors from a failing repository. Exercised against
 * `InMemoryEmployerRepository` through the same provider-injection pattern
 * as `useEmployeeForm.test.tsx`.
 */

import { act, create } from 'react-test-renderer';

import { CurrentEmployerProvider, RepositoryProvider, type Repositories } from '@/core';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import type { Employer, PayrollRunRepository, SettingsRepository } from '@/types';

import { useEmployerForm, type UseEmployerFormResult } from './useEmployerForm';

// Obviously-fake placeholder identifiers/names only (CLAUDE.md §6).
const FAKE_EMPLOYER: Employer = {
  id: 'employer-fake-seed',
  name: 'Empleador de Prueba',
  nif: '00000000T',
  address: 'Calle Falsa 123',
  ccc: '28000000000',
  defaultLugar: null,
  createdAt: 0,
};

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

function FormHarness({ onResult }: { onResult: (result: UseEmployerFormResult) => void }) {
  const result = useEmployerForm();
  onResult(result);
  return null;
}

async function renderUseEmployerForm(employerRepository: InMemoryEmployerRepository) {
  const repositories: Repositories = {
    employers: employerRepository,
    employees: new InMemoryEmployeeRepository([]),
    payrollRuns: fakePayrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let latest!: UseEmployerFormResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <FormHarness onResult={(result) => (latest = result)} />
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  // Flush bootstrap + load-by-id microtasks.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get current(): UseEmployerFormResult {
      return latest;
    },
  };
}

describe('useEmployerForm', () => {
  it('seeds values from the current employer', async () => {
    const repository = new InMemoryEmployerRepository([FAKE_EMPLOYER]);
    const harness = await renderUseEmployerForm(repository);

    expect(harness.current.loading).toBe(false);
    expect(harness.current.loadError).toBeNull();
    expect(harness.current.values).toEqual({
      name: 'Empleador de Prueba',
      nif: '00000000T',
      address: 'Calle Falsa 123',
      ccc: '28000000000',
      defaultLugar: '',
    });
  });

  it('seeds empty strings from bootstrap defaults (nif/address/ccc/defaultLugar null)', async () => {
    const bootstrapEmployer: Employer = {
      ...FAKE_EMPLOYER,
      nif: null,
      address: null,
      ccc: null,
      defaultLugar: null,
      name: 'Empleador',
    };
    const repository = new InMemoryEmployerRepository([bootstrapEmployer]);
    const harness = await renderUseEmployerForm(repository);

    expect(harness.current.values).toEqual({ name: 'Empleador', nif: '', address: '', ccc: '', defaultLugar: '' });
  });

  it('calls update() with the validated patch on valid input, never create()', async () => {
    const repository = new InMemoryEmployerRepository([FAKE_EMPLOYER]);
    const updateSpy = jest.spyOn(repository, 'update');
    const createSpy = jest.spyOn(repository, 'create');
    const harness = await renderUseEmployerForm(repository);

    await act(async () => {
      harness.current.setField('name', 'Empleador Actualizado');
    });

    let success = false;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(FAKE_EMPLOYER.id, {
      name: 'Empleador Actualizado',
      nif: '00000000T',
      address: 'Calle Falsa 123',
      ccc: '28000000000',
      defaultLugar: null,
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('edits and submits defaultLugar with a placeholder value', async () => {
    const repository = new InMemoryEmployerRepository([FAKE_EMPLOYER]);
    const updateSpy = jest.spyOn(repository, 'update');
    const harness = await renderUseEmployerForm(repository);

    await act(async () => {
      harness.current.setField('defaultLugar', 'Ciudad de Prueba');
    });

    let success = false;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(FAKE_EMPLOYER.id, {
      name: 'Empleador de Prueba',
      nif: '00000000T',
      address: 'Calle Falsa 123',
      ccc: '28000000000',
      defaultLugar: 'Ciudad de Prueba',
    });
  });

  it('surfaces validation errors and does not call update() on invalid input', async () => {
    const repository = new InMemoryEmployerRepository([FAKE_EMPLOYER]);
    const updateSpy = jest.spyOn(repository, 'update');
    const harness = await renderUseEmployerForm(repository);

    await act(async () => {
      harness.current.setField('name', '   ');
      harness.current.setField('nif', 'not-a-nif');
    });

    let success = true;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(false);
    expect(harness.current.errors).toEqual({ name: 'required', nif: 'invalid_format' });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('surfaces a save error when the repository rejects', async () => {
    const repository = new InMemoryEmployerRepository([FAKE_EMPLOYER]);
    jest.spyOn(repository, 'update').mockRejectedValueOnce(new Error('disk full'));
    const harness = await renderUseEmployerForm(repository);

    let success = true;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(false);
    expect(harness.current.saveError).toEqual({ code: 'save_failed', detail: 'disk full' });
    expect(harness.current.saving).toBe(false);
  });
});
