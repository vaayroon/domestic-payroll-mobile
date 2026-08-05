/**
 * Concrete `EmployerRepository` adapter — the only place that turns Drizzle
 * query results into `Employer` domain objects (via `mappers.ts`). Never
 * imported outside `services/db/`; wired in through `core/RepositoryProvider`.
 */

import { asc, eq } from 'drizzle-orm';

import type { Employer, EmployerRepository, NewEmployer } from '@/types';

import type { AppDatabase } from './client';
import { employerInsertFromNew, employerRowToDomain } from './mappers';
import { employers } from './schema';

export class EmployerRepositoryDrizzle implements EmployerRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly generateId: () => string,
    private readonly now: () => number,
  ) {}

  async list(): Promise<Employer[]> {
    // Ordered so `list()[0]` is a deterministic "current employer" resolution
    // (design ADR-2) even if more than one employer row ever exists.
    const rows = await this.db.select().from(employers).orderBy(asc(employers.createdAt)).all();
    return rows.map(employerRowToDomain);
  }

  async getById(id: string): Promise<Employer | null> {
    const row = await this.db.select().from(employers).where(eq(employers.id, id)).get();
    return row ? employerRowToDomain(row) : null;
  }

  async create(input: NewEmployer): Promise<Employer> {
    const insertRow = employerInsertFromNew(input, this.generateId(), this.now());
    const [row] = await this.db.insert(employers).values(insertRow).returning();
    if (!row) {
      throw new Error('EmployerRepositoryDrizzle.create: insert returned no row');
    }
    return employerRowToDomain(row);
  }

  async update(id: string, patch: Partial<NewEmployer>): Promise<Employer> {
    const [row] = await this.db
      .update(employers)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.nif !== undefined ? { nif: patch.nif } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
        ...(patch.ccc !== undefined ? { ccc: patch.ccc } : {}),
      })
      .where(eq(employers.id, id))
      .returning();
    if (!row) {
      throw new Error(`EmployerRepositoryDrizzle.update: no employer found for id "${id}"`);
    }
    return employerRowToDomain(row);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(employers).where(eq(employers.id, id));
  }
}
