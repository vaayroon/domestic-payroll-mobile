/**
 * Concrete `PayrollRunRepository` adapter — the only place that turns Drizzle
 * query results into `PayrollRun` domain objects (via `mappers.ts`). Never
 * imported outside `services/db/`; wired in through `core/RepositoryProvider`.
 */

import { and, eq } from 'drizzle-orm';

import type { NewPayrollRun, PayrollRun, PayrollRunRepository } from '@/types';

import type { AppDatabase } from './client';
import { payrollRunInsertFromNew, payrollRunRowToDomain } from './mappers';
import { payrollRuns } from './schema';

export class PayrollRunRepositoryDrizzle implements PayrollRunRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly generateId: () => string,
    private readonly now: () => number,
  ) {}

  async listByEmployee(employeeId: string): Promise<PayrollRun[]> {
    const rows = await this.db.select().from(payrollRuns).where(eq(payrollRuns.employeeId, employeeId)).all();
    return rows.map(payrollRunRowToDomain);
  }

  async getByPeriod(employeeId: string, periodYear: number, periodMonth: number): Promise<PayrollRun | null> {
    const row = await this.db
      .select()
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.employeeId, employeeId),
          eq(payrollRuns.periodYear, periodYear),
          eq(payrollRuns.periodMonth, periodMonth),
        ),
      )
      .get();
    return row ? payrollRunRowToDomain(row) : null;
  }

  async create(input: NewPayrollRun): Promise<PayrollRun> {
    const insertRow = payrollRunInsertFromNew(input, this.generateId(), this.now());
    const [row] = await this.db.insert(payrollRuns).values(insertRow).returning();
    if (!row) {
      throw new Error('PayrollRunRepositoryDrizzle.create: insert returned no row');
    }
    return payrollRunRowToDomain(row);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(payrollRuns).where(eq(payrollRuns.id, id));
  }
}
