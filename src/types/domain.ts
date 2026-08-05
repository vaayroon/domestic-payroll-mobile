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
  readonly createdAt: number;
}

/** Fields required to create a new `Employer`. `id`/`createdAt` are assigned by the repository. */
export interface NewEmployer {
  readonly name: string;
  readonly nif?: string | null;
  readonly address?: string | null;
  readonly ccc?: string | null;
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
}

/** A single free-form app-level setting, stored as a string value (e.g. the smoke-screen round-trip key). */
export interface AppSetting {
  readonly key: string;
  readonly value: string;
}
