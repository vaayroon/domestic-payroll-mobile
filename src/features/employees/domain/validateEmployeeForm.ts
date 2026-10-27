/**
 * Pure employee-form validator (design §"Pure functions"). No I/O — the
 * caller supplies `employerId` so the form stays employer-agnostic while the
 * result is still a full, persistable `NewEmployee`.
 */

import { parseEuroInput, validateNaf, validateNifNie, type EuroParseError } from '@/core';
import type { ContractType, NewEmployee } from '@/types/domain';

/**
 * Longest `grupoCotizacion` the form accepts, in characters after trimming.
 *
 * This is a LAYOUT bound, not a legal rule: it only protects the boxed worker
 * cell on the printed receipt from a pasted paragraph. No norm limits the
 * length of the value, and a TGSS document commonly prints a code plus a
 * description, which is why the bound is generous and nothing else about the
 * value is checked.
 */
export const GRUPO_COTIZACION_MAX_LENGTH = 40;

export interface EmployeeFormInput {
  readonly name: string;
  readonly nif: string;
  readonly naf: string;
  readonly baseGross: string;
  readonly alta: string;
  readonly baja: string;
  /** Free text as the TGSS assigned it. Empty or whitespace-only means "not on file" (`null`). */
  readonly grupoCotizacion: string;
  /** `''` means "not yet chosen" -- the form MUST require an explicit INDEFINIDO/TEMPORAL choice (spec "Employee.contractType"). */
  readonly contractType: ContractType | '';
}

export interface EmployeeFormErrors {
  name?: 'required';
  nif?: 'invalid';
  naf?: 'invalid';
  baseGross?: EuroParseError | 'not_positive';
  alta?: 'invalid_date';
  baja?: 'invalid_date' | 'before_alta';
  contractType?: 'required';
  grupoCotizacion?: 'too_long';
}

export type ValidateEmployeeResult = { ok: true; value: NewEmployee } | { ok: false; errors: EmployeeFormErrors };

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ParseIsoDateResult = { ok: true; iso: string } | { ok: false };

/**
 * Parses a strict `'YYYY-MM-DD'` string into a validated ISO date. Rejects
 * malformed strings AND calendar-invalid dates (e.g. `2026-02-30`) by
 * round-tripping through `Date.UTC` and checking the parts survived intact —
 * never trusts JS's lenient `Date` overflow behavior (e.g. `new Date(2026,1,30)`
 * silently rolling over into March).
 */
export function parseIsoDate(raw: string): ParseIsoDateResult {
  const match = ISO_DATE_PATTERN.exec(raw);
  if (match === null) {
    return { ok: false };
  }

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDate =
    roundTrip.getUTCFullYear() === year && roundTrip.getUTCMonth() === month - 1 && roundTrip.getUTCDate() === day;

  if (!isRealCalendarDate) {
    return { ok: false };
  }

  return { ok: true, iso: raw };
}

export function validateEmployeeForm(input: EmployeeFormInput, employerId: string): ValidateEmployeeResult {
  const errors: EmployeeFormErrors = {};

  const name = input.name.trim();
  if (name === '') {
    errors.name = 'required';
  }

  // NIF/NAF are optional (design "Employee identifiers"): empty input maps
  // to `null` inside the validators themselves, so no separate empty-check
  // is needed here -- only non-empty, malformed values fail. Mirrors how
  // `validateEmployerForm` wires `validateNifNie`/`validateCcc`. Unlike the
  // employer form, the specific `invalid_format`/`invalid_checksum` codes
  // are collapsed into a single `'invalid'` code here (design decision --
  // keeps the employee form's error surface minimal).
  const nifResult = validateNifNie(input.nif);
  if (!nifResult.ok) {
    errors.nif = 'invalid';
  }

  const nafResult = validateNaf(input.naf);
  if (!nafResult.ok) {
    errors.naf = 'invalid';
  }

  const parsedBaseGross = parseEuroInput(input.baseGross);
  if (!parsedBaseGross.ok) {
    errors.baseGross = parsedBaseGross.error;
  } else if (parsedBaseGross.value === 0) {
    errors.baseGross = 'not_positive';
  }

  let altaDate: string | null = null;
  const altaTrimmed = input.alta.trim();
  if (altaTrimmed !== '') {
    const parsedAlta = parseIsoDate(altaTrimmed);
    if (!parsedAlta.ok) {
      errors.alta = 'invalid_date';
    } else {
      altaDate = parsedAlta.iso;
    }
  }

  let bajaDate: string | null = null;
  const bajaTrimmed = input.baja.trim();
  if (bajaTrimmed !== '') {
    const parsedBaja = parseIsoDate(bajaTrimmed);
    if (!parsedBaja.ok) {
      errors.baja = 'invalid_date';
    } else {
      bajaDate = parsedBaja.iso;
    }
  }

  if (errors.baja === undefined && altaDate !== null && bajaDate !== null && bajaDate < altaDate) {
    errors.baja = 'before_alta';
  }

  if (input.contractType === '') {
    errors.contractType = 'required';
  }

  // The value is assigned by the TGSS and cannot be derived or verified, so it
  // is deliberately free text: no 1-11 check and no pattern. Only the layout
  // bound applies (see `GRUPO_COTIZACION_MAX_LENGTH`).
  const grupoCotizacionTrimmed = input.grupoCotizacion.trim();
  if (grupoCotizacionTrimmed.length > GRUPO_COTIZACION_MAX_LENGTH) {
    errors.grupoCotizacion = 'too_long';
  }

  if (
    errors.name !== undefined ||
    errors.nif !== undefined ||
    errors.naf !== undefined ||
    errors.baseGross !== undefined ||
    errors.alta !== undefined ||
    errors.baja !== undefined ||
    errors.contractType !== undefined ||
    errors.grupoCotizacion !== undefined
  ) {
    return { ok: false, errors };
  }

  // Re-narrow: the branches above guarantee `parsedBaseGross.ok`,
  // `nifResult.ok`, and `nafResult.ok` are all `true` at this point, but
  // TypeScript can't infer that across the `errors` object.
  if (!parsedBaseGross.ok || !nifResult.ok || !nafResult.ok) {
    return { ok: false, errors };
  }

  // Re-narrow: `errors.contractType` being unset guarantees a real choice was made.
  if (input.contractType === '') {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      employerId,
      name,
      nif: nifResult.value,
      naf: nafResult.value,
      baseGrossCents: parsedBaseGross.value,
      altaDate,
      bajaDate,
      contractType: input.contractType,
      grupoCotizacion: grupoCotizacionTrimmed === '' ? null : grupoCotizacionTrimmed,
    },
  };
}
