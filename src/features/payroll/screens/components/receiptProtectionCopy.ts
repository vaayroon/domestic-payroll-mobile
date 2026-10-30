/**
 * Spanish copy for password-protected receipts (spec R5/R10). The protection
 * only prevents ACCIDENTAL opening, so this copy must never promise security:
 * no "seguro", no "confidencial", no "imposible de abrir".
 */

/** Viewer failure for a protected file: wrong or underivable password, or a damaged file. */
export const PROTECTED_RECEIPT_FAILURE_COPY =
  'No se pudo abrir el recibo protegido. Vuelve a generarlo desde el historial de nóminas.';

/** Banner headline once the current file is encrypted. */
export const PROTECTED_RECEIPT_SUCCESS_COPY = 'Recibo generado y protegido con contraseña.';

/** Banner reminder: sharing gives the employee a file they cannot open without being told how. */
export const PROTECTED_RECEIPT_HINT_COPY = 'Recuerda indicar al empleado cómo abrir el recibo protegido.';
