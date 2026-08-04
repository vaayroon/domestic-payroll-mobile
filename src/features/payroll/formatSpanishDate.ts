/**
 * Spanish date/month formatting helpers (design ADR-3), promoted out of
 * `PayrollRunForm.tsx`'s inline `MONTH_NAMES` array so the receipt view-model
 * builder can share the exact same wording. Placed at the feature root (not
 * `core/`) because only payroll-feature code consumes it so far; promote to
 * `core/` only when a non-payroll feature needs it too.
 *
 * Pure, no I/O, no system clock read — every date/period is passed in.
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

/** e.g. `formatSpanishMonthYear(2026, 6)` -> `"junio de 2026"`. */
export function formatSpanishMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

/** e.g. `formatSpanishDate('2026-08-04')` -> `"4 de agosto de 2026"`. */
export function formatSpanishDate(iso: string): string {
  const parts = iso.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return `${day} de ${MONTH_NAMES[month - 1]} de ${year}`;
}
