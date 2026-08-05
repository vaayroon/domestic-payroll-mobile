/**
 * Shared `FAKE_EMPLOYER` fixture — consolidates the inline `Employer`
 * literals that used to be duplicated across employees/payroll test files
 * (design "Test + Fixture Plan"). Cross-feature import from
 * `features/payroll/*` is acceptable — payroll tests already import the
 * `testing/` fakes from this same directory.
 *
 * Obviously-fake placeholder identifiers/names only (CLAUDE.md §6 — no real
 * PII in source, docs, fixtures, or tests).
 */

import type { Employer } from '@/types';

export const FAKE_EMPLOYER: Employer = {
  id: 'employer-fake-seed',
  name: 'Empleador',
  nif: null,
  address: null,
  ccc: null,
  createdAt: 0,
};
