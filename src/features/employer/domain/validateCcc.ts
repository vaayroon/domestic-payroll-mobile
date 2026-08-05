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
 * separators, the input must be 11 or 12 numeric digits. Empty input is
 * valid and maps to `null` (the field is optional). The canonical stored
 * form is the digits-only string.
 *
 * ADR-5 (length): sources diverge on the número length — the CCC is variously
 * described as 11 digits (2 provincia + 7 número + 2 control) or 12 digits
 * (2 provincia + 8 número + 2 control), and no authoritative spec was
 * reachable to settle it. Rather than pin one length and risk rejecting a
 * valid CCC (the exact failure ADR-4 avoids), both lengths are accepted and
 * no provincia-range check is applied (province codes run 01-52 plus special
 * codes ≥53, so a hard cap risks false rejections too).
 *
 * RE-VERIFICATION OUTCOME (recibo-oficial slice, design ADR-2/B1): the CCC
 * checksum was re-investigated when the receipt gained a CCC line -- NO
 * authoritative TGSS control-digit spec was found this time either, so the
 * checksum is DEFERRED AGAIN. Structural-only validation (`\d{11,12}`) ships
 * unchanged. The receipt now DOES render the CCC value (see
 * `features/payroll/receipt/buildReceiptViewModel.ts`), but strictly as a
 * plain stored value -- no checksum badge, no "verified" claim is ever
 * rendered alongside it.
 */

const CCC_SEPARATOR_PATTERN = /[\s/-]/g;
const CCC_DIGITS_PATTERN = /^\d{11,12}$/;

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
