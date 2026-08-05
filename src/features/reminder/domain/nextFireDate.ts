/**
 * Pure calendar math for the monthly payroll reminder (design D2/D3).
 *
 * NO I/O, NO `Date.now()` -- `reference` is always an explicit argument, same
 * discipline as `features/payroll/domain/engine.ts`. The constructor choice is
 * the deliberate DIVERGENCE from `engine.ts`: this module builds dates with
 * the LOCAL-time constructor `new Date(y, monthIndex, day, hour, minute, 0, 0)`,
 * never `Date.UTC`. `engine.ts` reasons about calendar DATES only (no time of
 * day), so `Date.UTC` avoids local-timezone off-by-one-day drift there. Here
 * the output carries a real local wall-clock time ("día 5 a las 09:00 hora de
 * Madrid"), so the LOCAL constructor is required -- it resolves that wall
 * clock to an absolute instant using whichever IANA offset is in effect on
 * that specific date, which is what makes DST correct BY CONSTRUCTION on the
 * device (no manual offset math). Tests assert on the returned Date's LOCAL
 * getters (`getHours()`, etc.), which round-trip identically under any
 * machine timezone.
 */

/** Actual number of days in `month` (0-based, JS `Date` convention) of `year`. Leap years fall out automatically. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** `month` is 0-based; returns the following month, rolling `year` forward past December. */
function nextMonth(year: number, month: number): { readonly year: number; readonly month: number } {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

/** Builds the target occurrence for `year`-`month` (0-based), clamping `dayOfMonth` to the month's last day. */
function build(year: number, month: number, dayOfMonth: number, hour: number, minute: number): Date {
  const day = Math.min(dayOfMonth, daysInMonth(year, month));
  return new Date(year, month, day, hour, minute, 0, 0);
}

/**
 * Resolves the next local wall-clock instant at which the reminder should
 * fire, strictly after `reference` (spec NFD): if this cycle's occurrence in
 * `reference`'s month is strictly in the future, return it; otherwise
 * (already passed, or exactly equal -- spec NFD-7) roll to next month's
 * occurrence. Inputs are assumed pre-validated by the preferences codec.
 */
export function computeNextFireDate(reference: Date, dayOfMonth: number, hour: number, minute: number): Date {
  const year = reference.getFullYear();
  const month = reference.getMonth();

  const candidate = build(year, month, dayOfMonth, hour, minute);
  if (candidate.getTime() > reference.getTime()) {
    return candidate;
  }

  const next = nextMonth(year, month);
  return build(next.year, next.month, dayOfMonth, hour, minute);
}
