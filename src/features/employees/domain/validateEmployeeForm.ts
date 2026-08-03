/**
 * Pure employee-form validator (design §"Pure functions"). No I/O — the
 * caller supplies `employerId` so the form stays employer-agnostic while the
 * result is still a full, persistable `NewEmployee`.
 */

import type { NewEmployee } from '@/types/domain';

import { parseEuroInput, type EuroParseError } from './parseEuroInput';

export interface EmployeeFormInput {
  readonly name: string;
  readonly nif: string;
  readonly naf: string;
  readonly baseGross: string;
}

export interface EmployeeFormErrors {
  name?: 'required';
  baseGross?: EuroParseError | 'not_positive';
}

export type ValidateEmployeeResult = { ok: true; value: NewEmployee } | { ok: false; errors: EmployeeFormErrors };

export function validateEmployeeForm(input: EmployeeFormInput, employerId: string): ValidateEmployeeResult {
  const errors: EmployeeFormErrors = {};

  const name = input.name.trim();
  if (name === '') {
    errors.name = 'required';
  }

  const parsedBaseGross = parseEuroInput(input.baseGross);
  if (!parsedBaseGross.ok) {
    errors.baseGross = parsedBaseGross.error;
  } else if (parsedBaseGross.value === 0) {
    errors.baseGross = 'not_positive';
  }

  if (errors.name !== undefined || errors.baseGross !== undefined) {
    return { ok: false, errors };
  }

  // Re-narrow: the branches above guarantee `parsedBaseGross.ok === true` at
  // this point, but TypeScript can't infer that across the `errors` object.
  if (!parsedBaseGross.ok) {
    return { ok: false, errors };
  }

  const nif = input.nif.trim();
  const naf = input.naf.trim();

  return {
    ok: true,
    value: {
      employerId,
      name,
      nif: nif === '' ? null : nif,
      naf: naf === '' ? null : naf,
      baseGrossCents: parsedBaseGross.value,
    },
  };
}
