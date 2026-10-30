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
  ContractType,
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

/**
 * Narrows a stored contract-type string, treating anything unrecognised as
 * `null` -- i.e. as "this run is not anchored", which every reader already
 * handles.
 *
 * Drizzle's `enum` is a compile-time type only and the column carries no SQL
 * CHECK, so the value is whatever is on disk: a row written by a newer build
 * and read back after a downgrade, or a hand-edited database. Passing it
 * through unchecked would make `desempleoPer10000[value]` undefined, then
 * `NaN`, and `cents()` would throw while generating a receipt. Falling back is
 * strictly better than crashing on a document the user is trying to print.
 */
function toContractTypeOrNull(value: string | null): ContractType | null {
  return value === 'INDEFINIDO' || value === 'TEMPORAL' ? value : null;
}

// ---------------------------------------------------------------------------
// Employer
// ---------------------------------------------------------------------------

export function employerRowToDomain(row: EmployerRow): Employer {
  return {
    id: row.id,
    name: row.name,
    nif: row.nif,
    address: row.address,
    ccc: row.ccc,
    defaultLugar: row.defaultLugar,
    createdAt: row.createdAt,
  };
}

export function employerInsertFromNew(input: NewEmployer, id: string, createdAt: number): EmployerInsertRow {
  return {
    id,
    name: input.name,
    nif: input.nif ?? null,
    address: input.address ?? null,
    ccc: input.ccc ?? null,
    defaultLugar: input.defaultLugar ?? null,
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
    contractType: row.contractType,
    // Free text, so there is nothing to narrow it to: null stays null.
    grupoCotizacion: row.grupoCotizacion,
    receiptEncryptionEnabled: row.receiptEncryptionEnabled,
    receiptPasswordOverride: row.receiptPasswordOverride,
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
    contractType: input.contractType ?? 'INDEFINIDO',
    // Absent means "not on file" (null), never '' and never a default group.
    grupoCotizacion: input.grupoCotizacion ?? null,
    receiptEncryptionEnabled: input.receiptEncryptionEnabled ?? false,
    // Absent means "derive from the NIF/NIE" (null); the NIF is never copied here.
    receiptPasswordOverride: input.receiptPasswordOverride ?? null,
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
    periodStartDate: row.periodStartDate,
    periodEndDate: row.periodEndDate,
    baseCotizacionCents: row.baseCotizacionCents === null ? null : cents(row.baseCotizacionCents),
    contractType: toContractTypeOrNull(row.contractType),
    employerTotalEfectivoCents: row.employerTotalEfectivoCents === null ? null : cents(row.employerTotalEfectivoCents),
    createdAt: row.createdAt,
  };
}

export function payrollRunInsertFromNew(input: NewPayrollRun, id: string, createdAt: number): PayrollRunInsertRow {
  // Every cotización anchor defaults to null, NOT to the employee-side
  // `?? 'INDEFINIDO'` used above: an absent anchor means "this run was never
  // anchored", which is not the same as "this run was INDEFINIDO".
  const baseCotizacionCents = input.baseCotizacionCents ?? null;
  const employerTotalEfectivoCents = input.employerTotalEfectivoCents ?? null;

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
    periodStartDate: input.periodStartDate ?? null,
    periodEndDate: input.periodEndDate ?? null,
    baseCotizacionCents: baseCotizacionCents === null ? null : unbrand(baseCotizacionCents),
    contractType: input.contractType ?? null,
    employerTotalEfectivoCents: employerTotalEfectivoCents === null ? null : unbrand(employerTotalEfectivoCents),
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
