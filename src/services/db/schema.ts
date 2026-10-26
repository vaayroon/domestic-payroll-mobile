/**
 * Drizzle schema — the ONLY place in the codebase where Drizzle's table DSL
 * is defined. `services/db/**` is the sole directory allowed to import
 * `drizzle-orm` (see `eslint.config.js`'s `no-restricted-imports` guard).
 *
 * All monetary columns are `integer` cents (CLAUDE.md §4 — money is never a
 * float). Booleans and timestamps are also stored as SQLite integers (0/1 and
 * epoch milliseconds respectively) since SQLite has no native boolean/date
 * type. `mappers.ts` is responsible for translating these raw row shapes into
 * the domain types declared in `src/types`.
 */

import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

/** A single household employer (the app's account holder). Multi-employer-ready. */
export const employers = sqliteTable('employers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nif: text('nif'),
  address: text('address'),
  ccc: text('ccc'),
  defaultLugar: text('default_lugar'),
  createdAt: integer('created_at').notNull(),
});

/** A household employee belonging to one employer. Multi-employee from day one. */
export const employees = sqliteTable(
  'employees',
  {
    id: text('id').primaryKey(),
    employerId: text('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nif: text('nif'),
    naf: text('naf'),
    baseGrossCents: integer('base_gross_cents').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    altaDate: text('alta_date'),
    bajaDate: text('baja_date'),
    contractType: text('contract_type', { enum: ['INDEFINIDO', 'TEMPORAL'] }).notNull().default('INDEFINIDO'),
    // Grupo de cotización, as assigned by the TGSS. Deliberately nullable with NO
    // default: the value is not derivable from any norm, so the app can neither
    // compute nor verify it, and a default would print an invented group on a
    // legal receipt. null means "not on file" (every row created before this
    // column existed), never a default group.
    grupoCotizacion: text('grupo_cotizacion'),
  },
  (table) => [index('employees_employer_id_idx').on(table.employerId)],
);

/** One computed payroll run for one employee in one calendar month. */
export const payrollRuns = sqliteTable(
  'payroll_runs',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    periodYear: integer('period_year').notNull(),
    periodMonth: integer('period_month').notNull(),
    grossCents: integer('gross_cents').notNull(),
    ssDeductionCents: integer('ss_deduction_cents').notNull(),
    netCents: integer('net_cents').notNull(),
    prorated: integer('prorated', { mode: 'boolean' }).notNull().default(false),
    extraCents: integer('extra_cents').notNull().default(0),
    daysWorked: integer('days_worked').notNull().default(0),
    daysInMonth: integer('days_in_month').notNull().default(0),
    periodStartDate: text('period_start_date'),
    periodEndDate: text('period_end_date'),
    // Cotización anchors. Deliberately nullable with NO default, unlike
    // `employees.contract_type` above: nullability IS the "was this run
    // anchored?" signal, and a default would make every pre-existing row
    // read back as an anchored INDEFINIDO run.
    baseCotizacionCents: integer('base_cotizacion_cents'),
    contractType: text('contract_type', { enum: ['INDEFINIDO', 'TEMPORAL'] }),
    // The employer cuota efectiva this run was computed with, nullable with NO
    // default for the same reason as the two anchors above: null marks a run
    // that was never anchored, which a run anchored at 0 is not. A default
    // would erase that distinction on every pre-existing row.
    employerTotalEfectivoCents: integer('employer_total_efectivo_cents'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    unique('payroll_runs_employee_period_unique').on(table.employeeId, table.periodYear, table.periodMonth),
    index('payroll_runs_employee_id_idx').on(table.employeeId),
  ],
);

/** Free-form app-level key/value settings (used by the Foundation smoke screen). */
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Row/insert-shape types Drizzle infers from the tables above. `mappers.ts` is
// the ONLY place these touch the domain types in `src/types` — everything
// outside `services/db/` sees `Employer`/`Employee`/`PayrollRun`/`AppSetting`.
export type EmployerRow = typeof employers.$inferSelect;
export type EmployerInsertRow = typeof employers.$inferInsert;
export type EmployeeRow = typeof employees.$inferSelect;
export type EmployeeInsertRow = typeof employees.$inferInsert;
export type PayrollRunRow = typeof payrollRuns.$inferSelect;
export type PayrollRunInsertRow = typeof payrollRuns.$inferInsert;
export type AppSettingRow = typeof appSettings.$inferSelect;
