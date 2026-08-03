/**
 * Concrete `EmployeeRepository` adapter — the only place that turns Drizzle
 * query results into `Employee` domain objects (via `mappers.ts`). Never
 * imported outside `services/db/`; wired in through `core/RepositoryProvider`.
 */

import { eq } from 'drizzle-orm';

import type { Employee, EmployeeRepository, NewEmployee } from '@/types';

import type { AppDatabase } from './client';
import { employeeInsertFromNew, employeeRowToDomain } from './mappers';
import { employees } from './schema';

export class EmployeeRepositoryDrizzle implements EmployeeRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly generateId: () => string,
  ) {}

  async list(employerId: string): Promise<Employee[]> {
    const rows = await this.db.select().from(employees).where(eq(employees.employerId, employerId)).all();
    return rows.map(employeeRowToDomain);
  }

  async getById(id: string): Promise<Employee | null> {
    const row = await this.db.select().from(employees).where(eq(employees.id, id)).get();
    return row ? employeeRowToDomain(row) : null;
  }

  async create(input: NewEmployee): Promise<Employee> {
    const insertRow = employeeInsertFromNew(input, this.generateId());
    const [row] = await this.db.insert(employees).values(insertRow).returning();
    if (!row) {
      throw new Error('EmployeeRepositoryDrizzle.create: insert returned no row');
    }
    return employeeRowToDomain(row);
  }

  async update(id: string, patch: Partial<NewEmployee>): Promise<Employee> {
    const [row] = await this.db
      .update(employees)
      .set({
        ...(patch.employerId !== undefined ? { employerId: patch.employerId } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.nif !== undefined ? { nif: patch.nif } : {}),
        ...(patch.naf !== undefined ? { naf: patch.naf } : {}),
        ...(patch.baseGrossCents !== undefined ? { baseGrossCents: patch.baseGrossCents } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.altaDate !== undefined ? { altaDate: patch.altaDate } : {}),
        ...(patch.bajaDate !== undefined ? { bajaDate: patch.bajaDate } : {}),
      })
      .where(eq(employees.id, id))
      .returning();
    if (!row) {
      throw new Error(`EmployeeRepositoryDrizzle.update: no employee found for id "${id}"`);
    }
    return employeeRowToDomain(row);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(employees).where(eq(employees.id, id));
  }
}
