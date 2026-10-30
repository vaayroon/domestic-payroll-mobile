/**
 * Render test for `useReceiptPassword` (design D6, spec R10): the viewer route
 * carries only the non-secret `encrypted=1` flag, so the password is
 * re-derived from the employee. Placeholder identifiers only (CLAUDE.md §6).
 */

import { act, create } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import { makeEmployee } from '@/features/employees/testing/fixtures';
import type { Employee, EmployeeRepository, SettingsRepository } from '@/types';

import { useReceiptPassword, type ReceiptPasswordState } from './useReceiptPassword';
import { InMemoryPayrollRunRepository } from '../testing/fakes';

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

const fakeSettingsRepository: SettingsRepository = {
  get: notImplemented('SettingsRepository.get'),
  set: notImplemented('SettingsRepository.set'),
};

function HookHarness({
  employeeId,
  encrypted,
  onResult,
}: {
  employeeId: string | null;
  encrypted: boolean;
  onResult: (result: ReceiptPasswordState) => void;
}) {
  onResult(useReceiptPassword(employeeId, encrypted));
  return null;
}

async function renderUseReceiptPassword(
  employees: EmployeeRepository,
  employeeId: string | null,
  encrypted: boolean,
) {
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([]),
    employees,
    payrollRuns: new InMemoryPayrollRunRepository([]),
    settings: fakeSettingsRepository,
  };
  const seen: ReceiptPasswordState[] = [];

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <HookHarness employeeId={employeeId} encrypted={encrypted} onResult={(result) => seen.push(result)} />
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    seen,
    get current(): ReceiptPasswordState {
      return seen[seen.length - 1] as ReceiptPasswordState;
    },
  };
}

function repoWith(employee: Employee): InMemoryEmployeeRepository {
  return new InMemoryEmployeeRepository([employee]);
}

describe('useReceiptPassword', () => {
  it('needs no password for a plain file and never loads the employee', async () => {
    const getById = jest.fn();
    const employees = { ...repoWith(makeEmployee({ nif: '00000000T' })), getById } as unknown as EmployeeRepository;

    const harness = await renderUseReceiptPassword(employees, 'employee-fake-1', false);

    expect(harness.current).toEqual({ status: 'not_needed' });
    expect(getById).not.toHaveBeenCalled();
  });

  it('starts loading and then derives the normalized NIF for an encrypted receipt (spec R10 S1)', async () => {
    const harness = await renderUseReceiptPassword(
      repoWith(makeEmployee({ nif: ' 00000000-t ' })),
      'employee-fake-1',
      true,
    );

    expect(harness.seen[0]).toEqual({ status: 'loading' });
    expect(harness.current).toEqual({ status: 'ready', password: '00000000T' });
  });

  it('prefers the override when the employee has one', async () => {
    const harness = await renderUseReceiptPassword(
      repoWith(makeEmployee({ nif: '00000000T', receiptPasswordOverride: 'clave 1' })),
      'employee-fake-1',
      true,
    );

    expect(harness.current).toEqual({ status: 'ready', password: 'clave 1' });
  });

  it('is unavailable when the employee has no document and no override', async () => {
    const harness = await renderUseReceiptPassword(repoWith(makeEmployee({ nif: null })), 'employee-fake-1', true);

    expect(harness.current).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the employee no longer exists', async () => {
    const harness = await renderUseReceiptPassword(new InMemoryEmployeeRepository([]), 'employee-fake-1', true);

    expect(harness.current).toEqual({ status: 'unavailable' });
  });

  it('is unavailable, with no error text, when the repository rejects', async () => {
    const failing = {
      ...repoWith(makeEmployee()),
      getById: () => Promise.reject(new Error('db down 00000000T')),
    } as unknown as EmployeeRepository;

    const harness = await renderUseReceiptPassword(failing, 'employee-fake-1', true);

    expect(harness.current).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the route has no employee id', async () => {
    const harness = await renderUseReceiptPassword(repoWith(makeEmployee({ nif: '00000000T' })), null, true);

    expect(harness.current).toEqual({ status: 'unavailable' });
  });
});
