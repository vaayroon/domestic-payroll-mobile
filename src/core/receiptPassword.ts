/**
 * Pure rules for the open password of a protected receipt PDF (spec R1/R2,
 * design D2/D9). The password only stops ACCIDENTAL opening: an NIF/NIE is not
 * a secret, and nothing here (or in its copy) may claim otherwise.
 *
 * Why the limits are so narrow. The receipt is written with AES-128 (V4/R4,
 * `RECEIPT_ENCRYPTION_ALGORITHM` in `services/pdf/encryptPdfBytes.ts`), and
 * the R4 writer in `@cantoo/pdf-lib` 2.11.1 takes one byte per UTF-16 code
 * unit, throws above U+00FF and SILENTLY drops everything after the 32nd
 * character. The in-app viewer then hands the password to pdfium as modified
 * UTF-8, so U+0080 to U+00FF become two bytes there and the file would never
 * open. Only printable ASCII (U+0020 to U+007E) survives both ends, and the
 * limit is 32 characters (= 32 bytes). Both constants are coupled to the
 * algorithm: change them together.
 */

import type { Employee } from '@/types';

import { normalizeIdentityDocument } from './validateNifNie';

/** Maximum password length in characters, which equals bytes for printable ASCII (R4 limit). */
export const RECEIPT_PASSWORD_MAX_LENGTH = 32;

const FIRST_PRINTABLE_ASCII = 0x20;
const LAST_PRINTABLE_ASCII = 0x7e;

/** Where a resolved password came from; drives the wording of the mail body. */
export type ReceiptPasswordSource = 'document' | 'override';

export type ResolveReceiptPasswordResult =
  | { readonly ok: true; readonly password: string; readonly source: ReceiptPasswordSource }
  | { readonly ok: false; readonly reason: 'unavailable' };

export type ValidateReceiptPasswordOverrideResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: 'too_long' | 'invalid_characters' };

type PasswordProblem = 'too_long' | 'invalid_characters';

/** Checks an already-trimmed, non-empty candidate. Characters first, then length. */
function findPasswordProblem(candidate: string): PasswordProblem | null {
  // Compared per UTF-16 code unit on purpose: that is how the writer reads it,
  // and it rejects every surrogate (emoji, lone or paired) for free.
  for (let index = 0; index < candidate.length; index += 1) {
    const code = candidate.charCodeAt(index);
    if (code < FIRST_PRINTABLE_ASCII || code > LAST_PRINTABLE_ASCII) {
      return 'invalid_characters';
    }
  }
  return candidate.length > RECEIPT_PASSWORD_MAX_LENGTH ? 'too_long' : null;
}

/**
 * Validates the employer-typed own password. Trims; blank means "no override"
 * (`null`); anything outside printable ASCII or longer than 32 characters is
 * rejected rather than letting the writer encode it differently or truncate it.
 */
export function validateReceiptPasswordOverride(raw: string): ValidateReceiptPasswordOverrideResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: true, value: null };
  }
  const problem = findPasswordProblem(trimmed);
  return problem === null ? { ok: true, value: trimmed } : { ok: false, error: problem };
}

/**
 * Decides which password protects a receipt for an employee.
 *
 * - A non-blank override wins and is never replaced by the NIF. A stored
 *   override that no longer validates is `unavailable` (fail closed), NOT a
 *   silent fallback to the NIF, which would produce a file the employer does
 *   not expect.
 * - Otherwise the normalized NIF/NIE is used, provided it can be written and
 *   read back (printable ASCII, at most 32 characters). Legacy rows are not
 *   guaranteed to hold a valid document, so a bad one is `unavailable` too.
 */
export function resolveReceiptPassword(
  employee: Pick<Employee, 'nif' | 'receiptPasswordOverride'>,
): ResolveReceiptPasswordResult {
  const unavailable = { ok: false, reason: 'unavailable' } as const;

  if (employee.receiptPasswordOverride !== null) {
    const override = validateReceiptPasswordOverride(employee.receiptPasswordOverride);
    if (!override.ok) {
      return unavailable;
    }
    if (override.value !== null) {
      return { ok: true, password: override.value, source: 'override' };
    }
  }

  const document = normalizeIdentityDocument(employee.nif ?? '');
  if (document === '' || findPasswordProblem(document) !== null) {
    return unavailable;
  }
  return { ok: true, password: document, source: 'document' };
}
