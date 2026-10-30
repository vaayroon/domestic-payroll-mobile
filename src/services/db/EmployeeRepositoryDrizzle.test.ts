import { getTableColumns } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { EmployeeReceiptFileNameFormat } from '@/types';

import type { AppDatabase } from './client';
import { EmployeeRepositoryDrizzle } from './EmployeeRepositoryDrizzle';
import * as schema from './schema';

/**
 * The project has no SQLite engine under Jest (the device driver is native), so
 * these tests run the REAL Drizzle query builder against the `sqlite-proxy`
 * driver, which hands every statement to a callback instead of a database. The
 * callback records the SQL text and the bound parameters, and answers with one
 * `employees` row, so the adapter's whole path (builder, SQL, row mapper) runs.
 * Only what the database would do is simulated.
 */

interface RecordedStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

const EMPLOYEE_ID = 'employee-fake-1';
const FORMAT_COLUMN = '"receipt_file_name_format" = ?';

/** Values for every `employees` column, keyed by column name (obviously fake data). */
function employeeRow(receiptFileNameFormat: string | null): Record<string, unknown> {
  return {
    id: EMPLOYEE_ID,
    employer_id: 'employer-fake-1',
    name: 'Ana Prueba Ejemplo',
    nif: '00000000T',
    naf: '000000000000',
    base_gross_cents: 100000,
    active: 1,
    alta_date: null,
    baja_date: null,
    contract_type: 'INDEFINIDO',
    grupo_cotizacion: null,
    receipt_encryption_enabled: 0,
    receipt_password_override: null,
    receipt_file_name_format: receiptFileNameFormat,
  };
}

/** `RETURNING` rows come back as value arrays in table column order. */
function toReturningRow(values: Record<string, unknown>): unknown[] {
  return Object.values(getTableColumns(schema.employees)).map((column) => values[column.name]);
}

function createRepository(returnedFormat: string | null) {
  const statements: RecordedStatement[] = [];
  const db = drizzle(
    async (sql: string, params: unknown[]) => {
      statements.push({ sql, params });
      return { rows: [toReturningRow(employeeRow(returnedFormat))] };
    },
    { schema },
  );
  const repository = new EmployeeRepositoryDrizzle(
    db as unknown as AppDatabase,
    () => 'generated-id',
  );
  return { repository, statements };
}

describe('EmployeeRepositoryDrizzle.update (receipt file name format)', () => {
  it.each<EmployeeReceiptFileNameFormat>([
    'name-month-year',
    'name-year-month',
    'year-month-name',
    'month-year',
    'auto',
  ])('persists the format id %s and returns it', async (format) => {
    const { repository, statements } = createRepository(format);

    const updated = await repository.update(EMPLOYEE_ID, { receiptFileNameFormat: format });

    expect(statements).toHaveLength(1);
    expect(statements[0]?.sql).toContain(FORMAT_COLUMN);
    expect(statements[0]?.params).toContain(format);
    expect(updated.receiptFileNameFormat).toBe(format);
  });

  it('persists null, which clears the choice back to inheriting the general setting', async () => {
    const { repository, statements } = createRepository(null);

    const updated = await repository.update(EMPLOYEE_ID, { receiptFileNameFormat: null });

    expect(statements).toHaveLength(1);
    expect(statements[0]?.sql).toContain(FORMAT_COLUMN);
    expect(statements[0]?.params[0]).toBeNull();
    expect(updated.receiptFileNameFormat).toBeNull();
  });

  it('leaves the column out of the statement when the patch does not mention it', async () => {
    const { repository, statements } = createRepository('month-year');

    const updated = await repository.update(EMPLOYEE_ID, { name: 'Empleada Ejemplo' });

    expect(statements).toHaveLength(1);
    expect(statements[0]?.sql).toContain('"name" = ?');
    // The column is still listed in RETURNING, so look for it being assigned.
    expect(statements[0]?.sql).not.toContain(FORMAT_COLUMN);
    expect(updated.receiptFileNameFormat).toBe('month-year');
  });
});
