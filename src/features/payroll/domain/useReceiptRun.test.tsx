/**
 * Render test for `useReceiptRun` (design ADR-7): resolves a persisted run by
 * `employeeId` + `runId` through `PayrollRunRepository.listByEmployee`, with
 * no new repository method. Any failure degrades to `missing` and never
 * surfaces error text.
 */

import { act, create } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import type {
  EmployeeRepository,
  EmployerRepository,
  PayrollRun,
  PayrollRunRepository,
  SettingsRepository,
} from '@/types';
import { cents } from '@/types/money';

import { useReceiptRun, type UseReceiptRunResult } from './useReceiptRun';
import { InMemoryPayrollRunRepository } from '../testing/fakes';

// Obviously-fake placeholder identifiers/amounts only (CLAUDE.md §6).
const EMPLOYEE_ID = 'employee-fake-1';

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

const fakeEmployeeRepository: EmployeeRepository = {
  list: notImplemented('EmployeeRepository.list'),
  getById: notImplemented('EmployeeRepository.getById'),
  create: notImplemented('EmployeeRepository.create'),
  update: notImplemented('EmployeeRepository.update'),
  remove: notImplemented('EmployeeRepository.remove'),
};

const fakeEmployerRepository: EmployerRepository = {
  list: notImplemented('EmployerRepository.list'),
  getById: notImplemented('EmployerRepository.getById'),
  create: notImplemented('EmployerRepository.create'),
  update: notImplemented('EmployerRepository.update'),
  remove: notImplemented('EmployerRepository.remove'),
};

const fakeSettingsRepository: SettingsRepository = {
  get: notImplemented('SettingsRepository.get'),
  set: notImplemented('SettingsRepository.set'),
};

function runFixture(overrides: Partial<PayrollRun>): PayrollRun {
  return {
    id: 'payroll-run-fake-0',
    employeeId: EMPLOYEE_ID,
    periodYear: 2026,
    periodMonth: 1,
    grossCents: cents(90000),
    ssDeductionCents: cents(10000),
    netCents: cents(80000),
    prorated: false,
    extraCents: cents(0),
    daysWorked: 30,
    daysInMonth: 30,
    periodStartDate: null,
    periodEndDate: null,
    baseCotizacionCents: null,
    contractType: null,
    employerTotalEfectivoCents: null,
    createdAt: 0,
    ...overrides,
  };
}

function HookHarness({
  employeeId,
  runId,
  onResult,
}: {
  employeeId: string | null;
  runId: string | null;
  onResult: (result: UseReceiptRunResult) => void;
}) {
  onResult(useReceiptRun(employeeId, runId));
  return null;
}

async function renderUseReceiptRun(
  payrollRuns: PayrollRunRepository,
  employeeId: string | null,
  runId: string | null,
) {
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: fakeEmployeeRepository,
    payrollRuns,
    settings: fakeSettingsRepository,
  };

  const results: UseReceiptRunResult[] = [];
  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <HookHarness
          employeeId={employeeId}
          runId={runId}
          onResult={(result) => results.push(result)}
        />
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    results,
    get current(): UseReceiptRunResult {
      return results[results.length - 1]!;
    },
  };
}

describe('useReceiptRun', () => {
  it('starts in loading and resolves to ready with the matching run', async () => {
    const target = runFixture({ id: 'payroll-run-fake-target', periodMonth: 2 });
    const other = runFixture({ id: 'payroll-run-fake-other', periodMonth: 3 });
    const harness = await renderUseReceiptRun(
      new InMemoryPayrollRunRepository([other, target]),
      EMPLOYEE_ID,
      target.id,
    );

    expect(harness.results[0]).toEqual({ status: 'loading', run: null });
    expect(harness.current).toEqual({ status: 'ready', run: target });
  });

  it('resolves to missing when no run matches the id', async () => {
    const harness = await renderUseReceiptRun(
      new InMemoryPayrollRunRepository([runFixture({ id: 'payroll-run-fake-other' })]),
      EMPLOYEE_ID,
      'payroll-run-fake-unknown',
    );

    expect(harness.current).toEqual({ status: 'missing', run: null });
  });

  it('does not match a run that belongs to another employee', async () => {
    const foreign = runFixture({ id: 'payroll-run-fake-foreign', employeeId: 'employee-fake-2' });
    const harness = await renderUseReceiptRun(
      new InMemoryPayrollRunRepository([foreign]),
      EMPLOYEE_ID,
      foreign.id,
    );

    expect(harness.current).toEqual({ status: 'missing', run: null });
  });

  it('resolves to missing without querying the repository when an id is null', async () => {
    const listByEmployee = jest.fn();
    const repository: PayrollRunRepository = {
      listByEmployee,
      getByPeriod: notImplemented('PayrollRunRepository.getByPeriod'),
      create: notImplemented('PayrollRunRepository.create'),
      remove: notImplemented('PayrollRunRepository.remove'),
    };

    const nullEmployee = await renderUseReceiptRun(repository, null, 'payroll-run-fake-1');
    expect(nullEmployee.current).toEqual({ status: 'missing', run: null });

    const nullRun = await renderUseReceiptRun(repository, EMPLOYEE_ID, null);
    expect(nullRun.current).toEqual({ status: 'missing', run: null });

    expect(listByEmployee).not.toHaveBeenCalled();
  });

  it('degrades a repository rejection to missing and exposes no error text', async () => {
    const repository: PayrollRunRepository = {
      listByEmployee: () => Promise.reject(new Error('disk exploded')),
      getByPeriod: notImplemented('PayrollRunRepository.getByPeriod'),
      create: notImplemented('PayrollRunRepository.create'),
      remove: notImplemented('PayrollRunRepository.remove'),
    };

    const harness = await renderUseReceiptRun(repository, EMPLOYEE_ID, 'payroll-run-fake-1');

    expect(harness.current).toEqual({ status: 'missing', run: null });
    expect(Object.keys(harness.current).sort()).toEqual(['run', 'status']);
    expect(JSON.stringify(harness.current)).not.toContain('disk exploded');
  });
});
