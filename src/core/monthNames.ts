/**
 * Spanish month names, lowercase, January first (index = month - 1). Lives in
 * `core/` because two features need the exact same wording: the receipt text
 * (`features/payroll/formatSpanishDate`) and the receipt file name
 * (`core/receiptFileName`). Imported through its direct path, never the
 * `core/` barrel, so pure modules do not pull React providers in.
 *
 * Pure data, no I/O.
 */

export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;
