import type { TFunction } from 'i18next';

const MONTH_KEYS = [
  'm1',
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'm7',
  'm8',
  'm9',
  'm10',
  'm11',
  'm12',
] as const;

/**
 * UI-only month label in the active language: `"junio de 2026"` (es) or
 * `"June 2026"` (en). Receipts and mail keep using `formatSpanishMonthYear`;
 * this helper must never feed them.
 */
export function formatMonthYear(t: TFunction, year: number, month: number): string {
  const key = MONTH_KEYS[month - 1];
  if (key === undefined) {
    throw new RangeError(`month must be 1-12, received ${month}`);
  }
  return t(($) => $.common.monthYear, { month: t(($) => $.common.months[key]), year });
}
