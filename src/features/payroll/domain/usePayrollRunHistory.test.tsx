/**
 * Render test for `usePayrollRunHistory` (design ADR-5 / spec
 * "payroll-run-history" "Runs listed newest first"): proves runs are sorted
 * most-recent-first by period, and that an employee with no persisted runs
 * gets an empty list rather than an error. Exercised against
 * `InMemoryPayrollRunRepository` through the same provider-injection pattern
 * as `usePayrollRunForm.test.tsx`.
 */

import { act, create } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import type { EmployeeRepository, EmployerRepository, PayrollRun, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { usePayrollRunHistory, type UsePayrollRunHistoryResult } from './usePayrollRunHistory';
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
    createdAt: 0,
    ...overrides,
  };
}

function HookHarness({ onResult }: { onResult: (result: UsePayrollRunHistoryResult) => void }) {
  const result = usePayrollRunHistory(EMPLOYEE_ID);
  onResult(result);
  return null;
}

async function renderUsePayrollRunHistory(payrollRunRepository: InMemoryPayrollRunRepository) {
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: fakeEmployeeRepository,
    payrollRuns: payrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let latest!: UsePayrollRunHistoryResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <HookHarness onResult={(result) => (latest = result)} />
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get current(): UsePayrollRunHistoryResult {
      return latest;
    },
  };
}

describe('usePayrollRunHistory', () => {
  it('lists runs most-recent-first by period', async () => {
    const jan = runFixture({ id: 'payroll-run-fake-jan', periodYear: 2026, periodMonth: 1 });
    const mar = runFixture({ id: 'payroll-run-fake-mar', periodYear: 2026, periodMonth: 3 });
    const feb = runFixture({ id: 'payroll-run-fake-feb', periodYear: 2026, periodMonth: 2 });
    const repository = new InMemoryPayrollRunRepository([jan, mar, feb]);

    const harness = await renderUsePayrollRunHistory(repository);

    expect(harness.current.runs.map((run) => run.id)).toEqual([mar.id, feb.id, jan.id]);
    expect(harness.current.loading).toBe(false);
    expect(harness.current.error).toBeNull();
  });

  it('returns an empty list (not an error) when the employee has no runs', async () => {
    const harness = await renderUsePayrollRunHistory(new InMemoryPayrollRunRepository());

    expect(harness.current.runs).toEqual([]);
    expect(harness.current.error).toBeNull();
  });

  it('breaks same-period ties by createdAt descending', async () => {
    const older = runFixture({ id: 'payroll-run-fake-older', createdAt: 1 });
    const newer = runFixture({ id: 'payroll-run-fake-newer', createdAt: 2 });
    // Seeded directly via the constructor (bypasses `create()`'s duplicate-period guard).
    const repository = new InMemoryPayrollRunRepository([older, newer]);

    const harness = await renderUsePayrollRunHistory(repository);

    expect(harness.current.runs.map((run) => run.id)).toEqual([newer.id, older.id]);
  });
});
