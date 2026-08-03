/**
 * In-memory `PayrollRunRepository` fake for unit tests (design "Interfaces /
 * new repo fake" / tasks 7.1). Mirrors
 * `features/employees/testing/fakes.ts`'s style: real `expo-sqlite` cannot
 * run under `jest-expo` headless, so hooks and screens are exercised against
 * this fake through `RepositoryProvider` instead. It replicates the DB's
 * `UNIQUE(employee, year, month)` semantics in memory so duplicate-guard
 * tests exercise the same shape of check the real repository would need to
 * satisfy.
 *
 * Any seed data passed into this fake from tests MUST be obviously fake
 * (CLAUDE.md §6 — no real PII/amounts in source, docs, fixtures, or tests).
 */

import type { NewPayrollRun, PayrollRun, PayrollRunRepository } from '@/types';

let nextFakePayrollRunId = 0;

/** Deterministic, test-only id generator — never used outside fakes. */
function generateFakePayrollRunId(): string {
  nextFakePayrollRunId += 1;
  return `payroll-run-fake-${nextFakePayrollRunId}`;
}

export class InMemoryPayrollRunRepository implements PayrollRunRepository {
  private readonly rows: PayrollRun[];

  constructor(seed: PayrollRun[] = []) {
    this.rows = [...seed];
  }

  async listByEmployee(employeeId: string): Promise<PayrollRun[]> {
    return this.rows.filter((row) => row.employeeId === employeeId);
  }

  async getByPeriod(employeeId: string, periodYear: number, periodMonth: number): Promise<PayrollRun | null> {
    return (
      this.rows.find(
        (row) => row.employeeId === employeeId && row.periodYear === periodYear && row.periodMonth === periodMonth,
      ) ?? null
    );
  }

  async create(input: NewPayrollRun): Promise<PayrollRun> {
    const duplicate = await this.getByPeriod(input.employeeId, input.periodYear, input.periodMonth);
    if (duplicate !== null) {
      throw new Error(
        `InMemoryPayrollRunRepository.create: a run already exists for employee "${input.employeeId}" in ${input.periodMonth}/${input.periodYear}`,
      );
    }

    const payrollRun: PayrollRun = {
      id: generateFakePayrollRunId(),
      employeeId: input.employeeId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      grossCents: input.grossCents,
      ssDeductionCents: input.ssDeductionCents,
      netCents: input.netCents,
      prorated: input.prorated ?? false,
      createdAt: Date.now(),
    };
    this.rows.push(payrollRun);
    return payrollRun;
  }

  async remove(id: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index !== -1) {
      this.rows.splice(index, 1);
    }
  }
}
