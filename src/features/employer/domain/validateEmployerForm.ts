/**
 * Pure employer-form validator (design "Validation Module"), composing
 * `validateNifNie` + `validateCcc`. Mirrors the employee form's
 * validate*Form.ts -> use*Form.ts -> *Screen.tsx layering (CLAUDE.md §3):
 * no I/O, error codes only, never UI copy.
 */

import { validateNifNie } from '@/core';
import type { NewEmployer } from '@/types/domain';

import { validateCcc } from './validateCcc';

export interface EmployerFormInput {
  readonly name: string;
  readonly nif: string;
  readonly address: string;
  readonly ccc: string;
  readonly defaultLugar: string;
}

export interface EmployerFormErrors {
  name?: 'required';
  nif?: 'invalid_format' | 'invalid_checksum';
  ccc?: 'invalid_format';
}

export type ValidateEmployerFormResult =
  | { readonly ok: true; readonly value: NewEmployer }
  | { readonly ok: false; readonly errors: EmployerFormErrors };

export function validateEmployerForm(input: EmployerFormInput): ValidateEmployerFormResult {
  const errors: EmployerFormErrors = {};

  const name = input.name.trim();
  if (name === '') {
    errors.name = 'required';
  }

  const nifResult = validateNifNie(input.nif);
  if (!nifResult.ok) {
    errors.nif = nifResult.error;
  }

  const cccResult = validateCcc(input.ccc);
  if (!cccResult.ok) {
    errors.ccc = cccResult.error;
  }

  if (errors.name !== undefined || errors.nif !== undefined || errors.ccc !== undefined) {
    return { ok: false, errors };
  }

  // Re-narrow: the branches above guarantee both `nifResult.ok` and
  // `cccResult.ok` are `true` at this point, but TypeScript can't infer that
  // across the `errors` object.
  if (!nifResult.ok || !cccResult.ok) {
    return { ok: false, errors };
  }

  const address = input.address.trim();
  const defaultLugar = input.defaultLugar.trim();

  return {
    ok: true,
    value: {
      name,
      nif: nifResult.value,
      address: address === '' ? null : address,
      ccc: cccResult.value,
      defaultLugar: defaultLugar === '' ? null : defaultLugar,
    },
  };
}
