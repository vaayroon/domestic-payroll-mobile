/**
 * Pure NAF (Número de Afiliación a la Seguridad Social) validator.
 *
 * ADR STRUCTURAL-ONLY FALLBACK (mirrors `validateCcc`'s ADR-4/ADR-5): the NAF
 * carries a control-digit pair, but no authoritative TGSS control-digit
 * algorithm could be verified to certainty for this slice -- sources diverge
 * and no real, valid NAF is available to derive golden vectors from (using a
 * real one would be PII, forbidden in this repo per CLAUDE.md §6). Shipping a
 * guessed checksum was rejected as worse than shipping none, same call as
 * `validateCcc`.
 *
 * This validator therefore checks STRUCTURE ONLY: after stripping common
 * separators, the input must be 11 or 12 numeric digits (2-digit provincia +
 * 8 or 9-digit número + 2-digit control, depending on whether a leading zero
 * is kept). Empty input is valid and maps to `null` (the field is optional).
 * The canonical stored form is the digits-only string.
 */

const NAF_SEPARATOR_PATTERN = /[\s/-]/g;
const NAF_DIGITS_PATTERN = /^\d{11,12}$/;

export type ValidateNafResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: 'invalid_format' };

function normalize(raw: string): string {
  return raw.trim().replace(NAF_SEPARATOR_PATTERN, '');
}

export function validateNaf(raw: string): ValidateNafResult {
  const normalized = normalize(raw);
  if (normalized === '') {
    return { ok: true, value: null };
  }

  if (!NAF_DIGITS_PATTERN.test(normalized)) {
    return { ok: false, error: 'invalid_format' };
  }

  return { ok: true, value: normalized };
}
