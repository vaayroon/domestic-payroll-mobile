/**
 * Pure CCC (Código Cuenta de Cotización / "Nº S.S.") validator.
 *
 * ADR-4 STRUCTURAL-ONLY FALLBACK (locked for this slice): the TGSS weighted
 * mod-11 control-digit algorithm could not be verified to certainty — no
 * authoritative spec was reachable, sources diverge on the número length,
 * and verified golden vectors cannot be derived without a real valid CCC
 * (which would be PII, forbidden in this repo per CLAUDE.md §6). Shipping a
 * guessed checksum was rejected as worse than shipping none.
 *
 * This validator therefore checks STRUCTURE ONLY: after stripping common
 * separators, the input must be exactly 11 numeric digits. Empty input is
 * valid and maps to `null` (the field is optional). The canonical stored
 * form is the digits-only string.
 *
 * TODO(recibo-oficial slice): implement the TGSS control-digit checksum once
 * the exact weight vector + remainder-10/11 handling is authoritatively
 * verified, and re-validate/re-derive golden vectors at that time. Only then
 * does CCC get rendered on the receipt (design ADR-2).
 */

const CCC_SEPARATOR_PATTERN = /[\s/-]/g;
const CCC_DIGITS_PATTERN = /^\d{11}$/;

export type ValidateCccResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: 'invalid_format' };

function normalize(raw: string): string {
  return raw.trim().replace(CCC_SEPARATOR_PATTERN, '');
}

export function validateCcc(raw: string): ValidateCccResult {
  const normalized = normalize(raw);
  if (normalized === '') {
    return { ok: true, value: null };
  }

  if (!CCC_DIGITS_PATTERN.test(normalized)) {
    return { ok: false, error: 'invalid_format' };
  }

  return { ok: true, value: normalized };
}
