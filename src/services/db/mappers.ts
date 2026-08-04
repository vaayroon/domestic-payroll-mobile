/**
 * Mappers — the ONLY place a Drizzle row shape touches a domain type
 * (CLAUDE.md §3 / design §4). Every `*RepositoryDrizzle` adapter routes its
 * query results and insert payloads through these functions so nothing else
 * in `services/db/` (or beyond it) needs to know the raw column shape.
 *
 * Pure, side-effect-free, no I/O — fully unit-testable (see `mappers.test.ts`).
 */

import { cents, type Cents } from '@/types/money';
import type {
  AppSetting,
  Employee,
  Employer,
  NewEmployee,
  NewEmployer,
  NewPayrollRun,
  PayrollRun,
} from '@/types/domain';

import type {
  AppSettingRow,
  EmployeeInsertRow,
  EmployeeRow,
  EmployerInsertRow,
  EmployerRow,
  PayrollRunInsertRow,
  PayrollRunRow,
} from './schema';

// ---------------------------------------------------------------------------
// Employer
// ---------------------------------------------------------------------------

export function employerRowToDomain(row: EmployerRow): Employer {
  return {
    id: row.id,
    name: row.name,
    nif: row.nif,
    address: row.address,
    createdAt: row.createdAt,
  };
}

export function employerInsertFromNew(input: NewEmployer, id: string, createdAt: number): EmployerInsertRow {
  return {
    id,
    name: input.name,
    nif: input.nif ?? null,
    address: input.address ?? null,
    createdAt,
  };
}

// ---------------------------------------------------------------------------
// Employee
// ---------------------------------------------------------------------------

export function employeeRowToDomain(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employerId: row.employerId,
    name: row.name,
    nif: row.nif,
    naf: row.naf,
    baseGrossCents: cents(row.baseGrossCents),
    active: row.active,
    altaDate: row.altaDate,
    bajaDate: row.bajaDate,
  };
}

export function employeeInsertFromNew(input: NewEmployee, id: string): EmployeeInsertRow {
  return {
    id,
    employerId: input.employerId,
    name: input.name,
    nif: input.nif ?? null,
    naf: input.naf ?? null,
    baseGrossCents: unbrand(input.baseGrossCents),
    active: input.active ?? true,
    altaDate: input.altaDate ?? null,
    bajaDate: input.bajaDate ?? null,
  };
}

// ---------------------------------------------------------------------------
// PayrollRun
// ---------------------------------------------------------------------------

export function payrollRunRowToDomain(row: PayrollRunRow): PayrollRun {
  return {
    id: row.id,
    employeeId: row.employeeId,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    grossCents: cents(row.grossCents),
    ssDeductionCents: cents(row.ssDeductionCents),
    netCents: cents(row.netCents),
    prorated: row.prorated,
    extraCents: cents(row.extraCents),
    daysWorked: row.daysWorked,
    daysInMonth: row.daysInMonth,
    createdAt: row.createdAt,
  };
}

export function payrollRunInsertFromNew(input: NewPayrollRun, id: string, createdAt: number): PayrollRunInsertRow {
  return {
    id,
    employeeId: input.employeeId,
    periodYear: input.periodYear,
    periodMonth: input.periodMonth,
    grossCents: unbrand(input.grossCents),
    ssDeductionCents: unbrand(input.ssDeductionCents),
    netCents: unbrand(input.netCents),
    prorated: input.prorated ?? false,
    extraCents: unbrand(input.extraCents),
    daysWorked: input.daysWorked,
    daysInMonth: input.daysInMonth,
    createdAt,
  };
}

// ---------------------------------------------------------------------------
// AppSetting
// ---------------------------------------------------------------------------

export function appSettingRowToDomain(row: AppSettingRow): AppSetting {
  return { key: row.key, value: row.value };
}

// ---------------------------------------------------------------------------

/**
 * `Cents` is a branded `number` at the type level only — this is the single
 * documented unbranding point used when handing a domain money value back to
 * Drizzle's plain-`number` insert row shape.
 */
function unbrand(amount: Cents): number {
  return amount;
}
