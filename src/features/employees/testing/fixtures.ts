/**
 * Shared `FAKE_EMPLOYER` fixture and `makeEmployee` factory — consolidate the
 * inline `Employer`/`Employee` literals that used to be duplicated across
 * employees/payroll test files (design "Test + Fixture Plan"). Cross-feature
 * import from `features/payroll/*` is acceptable — payroll tests already
 * import the `testing/` fakes from this same directory.
 *
 * Obviously-fake placeholder identifiers/names only (CLAUDE.md §6 — no real
 * PII in source, docs, fixtures, or tests).
 */

import { cents, type Employee, type Employer } from '@/types';

export const FAKE_EMPLOYER: Employer = {
  id: 'employer-fake-seed',
  name: 'Empleador',
  nif: null,
  address: null,
  ccc: null,
  defaultLugar: null,
  createdAt: 0,
};

/**
 * Builds a complete `Employee` with neutral fake defaults. Tests pass only the
 * fields they care about, so adding a new required `Employee` field later is a
 * one-line change here instead of an edit to every test literal.
 */
export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'employee-fake-1',
    employerId: FAKE_EMPLOYER.id,
    name: 'Empleada de Prueba',
    nif: null,
    naf: null,
    baseGrossCents: cents(90000),
    active: true,
    altaDate: null,
    bajaDate: null,
    contractType: 'INDEFINIDO',
    grupoCotizacion: null,
    ...overrides,
  };
}
