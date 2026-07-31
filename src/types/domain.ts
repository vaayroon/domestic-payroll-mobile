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

/** The private household employer using the app (the account holder). */
export interface Employer {
  readonly id: string;
  readonly name: string;
  readonly nif: string | null;
  readonly address: string | null;
  readonly createdAt: number;
}

/** Fields required to create a new `Employer`. `id`/`createdAt` are assigned by the repository. */
export interface NewEmployer {
  readonly name: string;
  readonly nif?: string | null;
  readonly address?: string | null;
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
}

/** Fields required to create a new `Employee`. `id` is assigned by the repository. */
export interface NewEmployee {
  readonly employerId: string;
  readonly name: string;
  readonly nif?: string | null;
  readonly naf?: string | null;
  readonly baseGrossCents: Cents;
  readonly active?: boolean;
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
}

/** A single free-form app-level setting, stored as a string value (e.g. the smoke-screen round-trip key). */
export interface AppSetting {
  readonly key: string;
  readonly value: string;
}
