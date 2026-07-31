/**
 * Repository interfaces — the persistence boundary (task 2.3 / CLAUDE.md §3).
 *
 * Every method returns a DOMAIN type from `./domain`, never a Drizzle-inferred
 * row type. `features/*` and `core/*` depend on these interfaces only; the
 * concrete `*RepositoryDrizzle` adapters (which DO import Drizzle) live
 * confined to `src/services/db/` and are wired in via `core/RepositoryProvider`.
 */

import type { AppSetting, Employee, Employer, NewEmployee, NewEmployer, NewPayrollRun, PayrollRun } from './domain';

export interface EmployerRepository {
  list(): Promise<Employer[]>;
  getById(id: string): Promise<Employer | null>;
  create(input: NewEmployer): Promise<Employer>;
  update(id: string, patch: Partial<NewEmployer>): Promise<Employer>;
  remove(id: string): Promise<void>;
}

export interface EmployeeRepository {
  list(employerId: string): Promise<Employee[]>;
  getById(id: string): Promise<Employee | null>;
  create(input: NewEmployee): Promise<Employee>;
  update(id: string, patch: Partial<NewEmployee>): Promise<Employee>;
  remove(id: string): Promise<void>;
}

export interface PayrollRunRepository {
  listByEmployee(employeeId: string): Promise<PayrollRun[]>;
  getByPeriod(employeeId: string, periodYear: number, periodMonth: number): Promise<PayrollRun | null>;
  create(input: NewPayrollRun): Promise<PayrollRun>;
  remove(id: string): Promise<void>;
}

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<AppSetting>;
}
