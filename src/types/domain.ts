/**
 * Domain models — the shapes every feature, repository interface, and mapper
 * agrees on. These are plain data types with NO Drizzle/ORM types anywhere
 * (CLAUDE.md §3 — `services/*` are infrastructure adapters; they know nothing
 * about UI, and nothing outside `services/db/` knows about the ORM).
 *
 * Money fields use the branded `Cents` type from `./money` — never a plain
 * `number` — so a raw unbranded amount can't accidentally flow into payroll
 * math without going through `cents()` first.
 *
 * The data model is multi-employee from day one (CLAUDE.md §4): an `Employer`
 * has many `Employee`s, even though the app currently seeds a single one.
 */

import type { Cents } from './money';

/**
 * How an employee's employment is classified under the Régimen Especial de
 * Empleados de Hogar -- selects the worker's desempleo (unemployment)
 * contribution rate (6,40% INDEFINIDO / 6,45% TEMPORAL). Declared here (not
 * in `features/payroll/domain/ssContribution.ts`) so `types/` stays
 * dependency-free (CLAUDE.md §3): `ssContribution.ts` imports this type from
 * `@/types` rather than the other way around.
 */
export type ContractType = 'INDEFINIDO' | 'TEMPORAL';

/**
 * The readable file-name layouts a receipt PDF can use (see
 * `core/receiptFileName` for the exact output of each). Declared here so
 * `types/` stays dependency-free (CLAUDE.md §3).
 */
export type ReceiptFileNameFormatId =
  | 'name-month-year'
  | 'name-year-month'
  | 'year-month-name'
  | 'month-year';

/**
 * Per-employee file-name choice: a format id, or `'auto'` to force the random
 * name `expo-print` picks even when a general format is set. `null` (not part
 * of this union) means "inherit the general setting".
 */
export type EmployeeReceiptFileNameFormat = ReceiptFileNameFormatId | 'auto';

/** The private household employer using the app (the account holder). */
export interface Employer {
  readonly id: string;
  readonly name: string;
  readonly nif: string | null;
  readonly address: string | null;
  /**
   * Código Cuenta de Cotización (Nº S.S.), digits-only normalized. Persisted
   * but NOT rendered on the receipt this slice — see
   * `features/employer/domain/validateCcc.ts` for the structural-only
   * validation currently shipped (control-digit checksum deferred).
   */
  readonly ccc: string | null;
  /**
   * Default issuing place ("lugar") pre-filled on every receipt's "En
   * [lugar], a [fecha]" line for this employer's employees. `null` preserves
   * the current blank `………` placeholder — see `buildReceiptViewModel.ts`.
   */
  readonly defaultLugar: string | null;
  readonly createdAt: number;
}

/** Fields required to create a new `Employer`. `id`/`createdAt` are assigned by the repository. */
export interface NewEmployer {
  readonly name: string;
  readonly nif?: string | null;
  readonly address?: string | null;
  readonly ccc?: string | null;
  readonly defaultLugar?: string | null;
}

/** A household employee under the Régimen Especial de Empleados de Hogar. */
export interface Employee {
  readonly id: string;
  readonly employerId: string;
  readonly name: string;
  readonly nif: string | null;
  readonly naf: string | null;
  readonly baseGrossCents: Cents;
  readonly active: boolean;
  readonly altaDate: string | null;
  readonly bajaDate: string | null;
  readonly contractType: ContractType;
  /**
   * Grupo de cotización exactly as the TGSS assigned it (free text: a code, or a
   * code plus a description). `null` means "not on file", which is what every
   * employee created before this field existed reads back as. It is never
   * derived, defaulted or backfilled.
   */
  readonly grupoCotizacion: string | null;
  /**
   * Whether new receipts for this employee are generated password-protected.
   * It only stops accidental opening; it is not a security measure.
   */
  readonly receiptEncryptionEnabled: boolean;
  /**
   * Own password for this employee's protected receipts, stored in plaintext by
   * decision. `null` means "derive it from the NIF/NIE". Never copied from the
   * NIF, and never replaced by it once set.
   */
  readonly receiptPasswordOverride: string | null;
  /**
   * Readable receipt file name format for this employee. `null` means "inherit
   * the general setting" (what every employee created before this field existed
   * reads back as); `'auto'` forces the random name even when a general format
   * is set; a format id wins over the general setting.
   */
  readonly receiptFileNameFormat: EmployeeReceiptFileNameFormat | null;
}

/** Fields required to create a new `Employee`. `id` is assigned by the repository. */
export interface NewEmployee {
  readonly employerId: string;
  readonly name: string;
  readonly nif?: string | null;
  readonly naf?: string | null;
  readonly baseGrossCents: Cents;
  readonly active?: boolean;
  readonly altaDate?: string | null;
  readonly bajaDate?: string | null;
  /** Defaults to `'INDEFINIDO'` when omitted (matches the DB column's default; see `mappers.ts`). */
  readonly contractType?: ContractType;
  /** Defaults to `null` ("not on file") when omitted; never to a group. */
  readonly grupoCotizacion?: string | null;
  /** Defaults to `false` when omitted. */
  readonly receiptEncryptionEnabled?: boolean;
  /** Defaults to `null` (derive from the NIF/NIE) when omitted. */
  readonly receiptPasswordOverride?: string | null;
  /** Defaults to `null` (inherit the general setting) when omitted. */
  readonly receiptFileNameFormat?: EmployeeReceiptFileNameFormat | null;
}

/** One computed payroll run for one employee in one calendar month (CLAUDE.md §5). */
export interface PayrollRun {
  readonly id: string;
  readonly employeeId: string;
  readonly periodYear: number;
  readonly periodMonth: number;
  readonly grossCents: Cents;
  readonly ssDeductionCents: Cents;
  readonly netCents: Cents;
  readonly prorated: boolean;
  readonly extraCents: Cents;
  readonly daysWorked: number;
  readonly daysInMonth: number;
  /**
   * Persisted per-run period date range (ISO `YYYY-MM-DD`), edited/confirmed
   * on the run form and prefilled from `Employee.altaDate`/`bajaDate` clipped
   * to the selected month. `null` for runs saved before this field existed
   * (no backfill) or when the range is otherwise unknown.
   */
  readonly periodStartDate: string | null;
  readonly periodEndDate: string | null;
  /**
   * The base de cotización this run was actually computed from, so a reprint
   * reproduces the period's own figures instead of recomputing them from the
   * employee's current salary. `null` for runs saved before this field
   * existed (no backfill) — those fall back to the current recompute.
   */
  readonly baseCotizacionCents: Cents | null;
  /**
   * The contract type in force for this run, which fixes the desempleo rate.
   * `null` for runs saved before this field existed (no backfill); null is
   * the "not anchored" signal, never a default.
   */
  readonly contractType: ContractType | null;
  /**
   * The employer's cuota efectiva (nominal total net of both benefits) this
   * run was computed with. The base and contract anchors above pin the base
   * and the rate SELECTOR, not the rate TABLE: correcting an employer rate in
   * `SS_RATES_BY_YEAR` for an already-settled year leaves the worker cuota
   * untouched, so only an employer-side figure of the run's own can expose it.
   * `null` for runs saved before this field existed (no backfill); null is
   * the "not anchored" signal, never a default.
   */
  readonly employerTotalEfectivoCents: Cents | null;
  readonly createdAt: number;
}

/** Fields required to create a new `PayrollRun`. `id`/`createdAt` are assigned by the repository. */
export interface NewPayrollRun {
  readonly employeeId: string;
  readonly periodYear: number;
  readonly periodMonth: number;
  readonly grossCents: Cents;
  readonly ssDeductionCents: Cents;
  readonly netCents: Cents;
  readonly prorated?: boolean;
  readonly extraCents: Cents;
  readonly daysWorked: number;
  readonly daysInMonth: number;
  readonly periodStartDate?: string | null;
  readonly periodEndDate?: string | null;
  readonly baseCotizacionCents?: Cents | null;
  readonly contractType?: ContractType | null;
  readonly employerTotalEfectivoCents?: Cents | null;
}

/** A single free-form app-level setting, stored as a string value (e.g. the smoke-screen round-trip key). */
export interface AppSetting {
  readonly key: string;
  readonly value: string;
}
