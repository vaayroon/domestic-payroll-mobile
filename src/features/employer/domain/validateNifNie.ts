/**
 * Pure NIF/NIE validator — full mod-23 checksum (design "Checksum
 * Algorithms" / spec "NIF/NIE Validation with Checksum"). Returns error
 * codes only, no UI copy; the screen maps codes to Spanish messages.
 *
 * CIF (legal-entity ids) are intentionally NOT accepted (design ADR-3): this
 * app's domain is a private household employer (a natural person), so the
 * `nif` field only ever needs to validate as a NIF or a NIE.
 */

/** Index = 8-digit number mod 23 (T=0, R=1, ... E=22). */
const CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

const NIF_PATTERN = /^\d{8}[A-Z]$/;
const NIE_PATTERN = /^[XYZ]\d{7}[A-Z]$/;

/** NIE prefix letter maps to a leading digit before applying the NIF checksum table. */
const NIE_PREFIX_DIGIT: Record<'X' | 'Y' | 'Z', string> = { X: '0', Y: '1', Z: '2' };

export type ValidateNifNieResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: 'invalid_format' | 'invalid_checksum' };

/**
 * Normalizes free-form input: trims, uppercases, and strips internal
 * whitespace/dashes so "12345678-z" and "12345678 Z" validate the same as
 * "12345678Z".
 */
function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

function checkLetter(value: string, number: number, letter: string): ValidateNifNieResult {
  const expected = CONTROL_LETTERS.charAt(number % 23);
  if (expected !== letter) {
    return { ok: false, error: 'invalid_checksum' };
  }
  return { ok: true, value };
}

/**
 * Validates a NIF (`^\d{8}[A-Z]$`) or NIE (`^[XYZ]\d{7}[A-Z]$`) string.
 * Empty input is valid and maps to `null` (the field is optional).
 */
export function validateNifNie(raw: string): ValidateNifNieResult {
  const normalized = normalize(raw);
  if (normalized === '') {
    return { ok: true, value: null };
  }

  if (NIF_PATTERN.test(normalized)) {
    const number = Number(normalized.slice(0, 8));
    const letter = normalized.charAt(8);
    return checkLetter(normalized, number, letter);
  }

  if (NIE_PATTERN.test(normalized)) {
    const prefix = normalized.charAt(0) as 'X' | 'Y' | 'Z';
    const number = Number(NIE_PREFIX_DIGIT[prefix] + normalized.slice(1, 8));
    const letter = normalized.charAt(8);
    return checkLetter(normalized, number, letter);
  }

  return { ok: false, error: 'invalid_format' };
}
