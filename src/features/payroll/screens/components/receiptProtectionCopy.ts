/**
 * Spanish copy for password-protected receipts (spec R5/R10). The protection
 * only prevents ACCIDENTAL opening, so this copy must never promise security:
 * no "seguro", no "confidencial", no "imposible de abrir".
 */

/** Viewer failure for a protected file: wrong or underivable password, or a damaged file. */
export const PROTECTED_RECEIPT_FAILURE_COPY =
  'No se pudo abrir el recibo protegido. Vuelve a generarlo desde el historial de nóminas.';
