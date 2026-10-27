/**
 * Pure payroll calculation engine (CLAUDE.md §3, §5).
 *
 * NO I/O, NO `Date.now()`, NO other system-time read anywhere in this module.
 * Every temporal value (period year/month, alta/baja dates) arrives as an
 * explicit argument; the screen layer is responsible for supplying "today"
 * when it needs one. This is what keeps `calculatePayrollRun` deterministic
 * and unit-testable without a clock.
 *
 * Day counting: `daysInMonth(year, month)` returns the real number of days in
 * that month (28-31), leap years included. It bounds the run month --
 * `clipIntervalToMonth` clamps the interval against it and, when the interval
 * overlaps the month, derives `prorated` from it -- but it is never a devengo
 * divisor (see "SS decoupled proration" below). What a DAY-proration ratio
 * divides BY depends on the path and is documented at each site: /30 for the
 * run-month salary and SS proration, /180 for the PRORATE pagas extra, and the
 * real semester length for the INCLUDE_IN_MONTH pagas extra. All ISO date
 * parsing goes through `Date.UTC`
 * on the individual year/month/day parts -- never `new Date(str)` (which is
 * local-timezone-dependent) and never a relative "now".
 *
 * Semester-accrual convention (see design ADR-1 / decision #674): the pagas
 * extra (June and December) are legally accrued over a natural half-year --
 * January 1 to June 30 for the June payment, July 1 to December 31 for the
 * December payment -- rather than over the run month itself. `semesterBounds`
 * and `daysWorkedInInterval` express that accrual window and the calendar-day
 * overlap of the employment interval with it, independent of the run month's
 * own day-count.
 *
 * Rounding discipline (money.ts §4): every amount is rounded at most once,
 * via `multiplyByRatio`. `calculatePayrollRun` never re-rounds a value that
 * already went through `multiplyByRatio`; `netCents` is an exact
 * `subtractCents` of two already-rounded amounts.
 *
 * SS decoupled proration (design ADR-4 / spec "ss-contribution"): the worker
 * SS cuota is no longer a manually-entered `fullMonthSsCents` prorated by the
 * SAME ratio as salary -- it is COMPUTED by `computeWorkerSs` (see
 * `ssContribution.ts`) from the employee's base gross, the run's injected
 * `RatesConfig`, and `contractType`, and prorated by its own
 * `daysWorked/SS_DIVISOR` (always /30, per TGSS mechanics) ratio. Salary
 * devengo proration (see `SALARY_DEVENGO_DIVISOR` below) now uses the SAME
 * /30 mes-comercial ratio -- the real calendar `daysInMonth` (28-31) is NEVER
 * a devengo divisor for either salary or SS, though it does bound the run
 * month and feed the `prorated` flag.
 * `SALARY_DEVENGO_DIVISOR` and `SS_DIVISOR` are numerically equal by design
 * (guarded by a drift-lock test) but remain distinct named constants because
 * they rest on different legal bases -- see `SALARY_DEVENGO_DIVISOR`'s
 * doc-comment.
 *
 * Employer figure: the same run also yields the employer's cuota efectiva
 * (`PayrollResult.employerTotalEfectivoCents`), computed from the base the
 * worker cuota resolved. It is not part of the net; it exists to be persisted
 * as the run's employer anchor.
 */

import { type Cents, addCents, cents, multiplyByRatio, subtractCents } from '@/types/money';

import { computeEmployerSsFromBase, computeWorkerSs, SS_DIVISOR, type ContractType, type RatesConfig } from './ssContribution';

/**
 * Divisor for the salary devengo proration: /30, the "mes comercial"
 * convention. The PRORATE pagas extra uses it too, as the /30 factor inside
 * its /(6 x 30) ratio. This is a LABOR-law basis, distinct from
 * `SS_DIVISOR`'s TGSS/contribution-base basis, even though the two are
 * numerically equal:
 * - The Tribunal Supremo's daily-rate floor (STS 25/11/2019, salario
 *   anual/365) sets a per-day minimum; /30 (e.g. base 1.221,00 -> 40,70
 *   €/día) meets that floor, while /31 (39,39 €/día) under-pays it on a
 *   31-day month.
 * - It matches the gestoría "mes comercial" convention used to draft the
 *   recibo (every month treated as 30 days for devengo purposes).
 * - It keeps the recibo internally coherent: the salary daily basis aligns
 *   with the SS contribution-base daily basis (both /30), so the two never
 *   silently diverge on the same document.
 *
 * This is NOT a reuse of `SS_DIVISOR` -- see the drift-lock test in
 * `engine.test.ts` (`SALARY_DEVENGO_DIVISOR === SS_DIVISOR`) for why the
 * numeric equality is asserted rather than assumed.
 */
export const SALARY_DEVENGO_DIVISOR = 30;

/** How the two annual pagas extra (bonus payments) are folded into a run. */
export type ExtraPayMode = 'INCLUDE_IN_MONTH' | 'PRORATE' | 'EXCLUDE';

/** Every value `calculatePayrollRun` needs -- nothing is read from a clock or a store. */
export interface PayrollInput {
  /** Employee's full-month base gross salary. */
  readonly baseGrossCents: Cents;
  /** The run period year's resolved SS rates/tramo table (design ADR-2: `year_not_loaded` is handled at the form-hook boundary, never here). */
  readonly ratesConfig: RatesConfig;
  /** Selects the worker's desempleo rate (6,40% INDEFINIDO / 6,45% TEMPORAL). */
  readonly contractType: ContractType;
  /** Calendar year of the run, e.g. 2026. */
  readonly periodYear: number;
  /** Calendar month of the run, 1-12. */
  readonly periodMonth: number;
  /** ISO `'YYYY-MM-DD'` hire date, or `null` if employed since before the period. */
  readonly altaDate: string | null;
  /** ISO `'YYYY-MM-DD'` termination date, or `null` if still employed after the period. */
  readonly bajaDate: string | null;
  readonly extraPayMode: ExtraPayMode;
  /**
   * Optional per-run period date range (ISO `'YYYY-MM-DD'`), edited/confirmed
   * on the run form. When either bound is present, it SUPPLEMENTS (never
   * replaces) `altaDate`/`bajaDate` for the run-month's effective-period
   * derivation only -- `resolveExtraPayCents`'s semester accrual keeps using
   * `altaDate`/`bajaDate` regardless, since a per-month range cannot express a
   * 6-month accrual window. `null`/absent on both falls back to
   * `resolveEffectivePeriod(altaDate, bajaDate)`.
   */
  readonly periodStartDate?: string | null;
  readonly periodEndDate?: string | null;
}

/** The run month resolved against the employment interval, in calendar days. */
export interface EffectivePeriod {
  /** First day of the month actually worked, 1..daysInMonth (clamped by alta). */
  readonly startDay: number;
  /** Last day of the month actually worked, 0..daysInMonth (clamped by baja; 0 = no overlap). */
  readonly endDay: number;
  /** Exact count of calendar days worked inside the period. */
  readonly daysWorked: number;
  /** Actual number of days in `periodMonth` (28-31). */
  readonly daysInMonth: number;
  /** Whether alta/baja clip the calendar month at all. */
  readonly prorated: boolean;
}

/** The fully computed result of one payroll run. */
export interface PayrollResult {
  /** Prorated base gross plus any pagas extra component. */
  readonly grossCents: Cents;
  /** Prorated Social Security deduction. */
  readonly ssDeductionCents: Cents;
  /** `grossCents - ssDeductionCents`, exact (no further rounding). */
  readonly netCents: Cents;
  /** Derived from `EffectivePeriod.prorated` -- never an input. */
  readonly prorated: boolean;
  /** The pagas extra component included in `grossCents`, if any. */
  readonly extraCents: Cents;
  readonly daysWorked: number;
  readonly daysInMonth: number;
  /**
   * The base de cotización this run was computed from, surfaced so the caller
   * can persist it as the run's anchor. It is the SAME value `computeWorkerSs`
   * already resolved for `ssDeductionCents` above -- read off the breakdown,
   * never resolved a second time, so no new rounding point exists and the
   * anchor cannot disagree with the cuota it produced.
   */
  readonly baseCotizacionCents: Cents;
  /** Echo of the input contract type, which fixes the desempleo rate, for the caller to persist alongside the base. */
  readonly contractType: ContractType;
  /**
   * The employer's cuota efectiva for this run, surfaced so the caller can
   * persist it as the run's third anchor.
   *
   * This is the only EMPLOYER-SIDE figure here. It is computed here rather
   * than in the run form so that it can read the base `computeWorkerSs`
   * ALREADY resolved: the employer anchor and the worker cuota are then the
   * same period on the same base, with no second base resolution between them.
   * The form would instead have to re-derive the SS days normalization
   * (`prorated ? daysWorked : SS_DIVISOR`) that lives below, adding a third
   * copy of it to the two this codebase already has (here and
   * `resolveSsDaysWorked` in the receipt).
   */
  readonly employerTotalEfectivoCents: Cents;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Actual number of days in `month` (1-based) of `year`.
 *
 * `Date.UTC(year, month, 0)` is "the last day of the previous month" when fed
 * a 1-based `month` value, which is exactly "the last day of `month`" here
 * because `month` is already 1-based (so `month` in `Date.UTC` terms is the
 * *next* month, 0-indexed). Leap years fall out automatically.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parses an ISO `'YYYY-MM-DD'` string into a UTC-midnight epoch (ms). Assumes a valid, already-validated string. */
function isoToUtcEpoch(iso: string): number {
  const parts = iso.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return Date.UTC(year, month - 1, day);
}

/**
 * Shared clip-to-month math: resolves how much of calendar month
 * `year`-`month` overlaps interval `[startIso?..endIso?]`. `null` on either
 * side means "unbounded" on that side. This is the SINGLE source of the
 * interval∩month day-count logic -- `resolveEffectivePeriod` (alta/baja) and
 * `resolveEffectivePeriodFromRange` (persisted period range) both delegate
 * here rather than duplicating it. An inverted interval (`startIso` after
 * `endIso`) degrades gracefully to the same "no overlap" result as an
 * interval that falls entirely outside the month -- callers that must reject
 * an inverted range as a validation error (e.g. the run form, spec Scenario
 * 9) do so BEFORE calling this function; this function itself never throws.
 */
function clipIntervalToMonth(
  year: number,
  month: number,
  startIso: string | null,
  endIso: string | null,
): EffectivePeriod {
  const totalDays = daysInMonth(year, month);
  const periodStartEpoch = Date.UTC(year, month - 1, 1);
  const periodEndEpoch = Date.UTC(year, month - 1, totalDays);

  const startEpoch = startIso === null ? null : isoToUtcEpoch(startIso);
  const endEpoch = endIso === null ? null : isoToUtcEpoch(endIso);

  const effectiveStartEpoch = startEpoch === null ? periodStartEpoch : Math.max(startEpoch, periodStartEpoch);
  const effectiveEndEpoch = endEpoch === null ? periodEndEpoch : Math.min(endEpoch, periodEndEpoch);

  if (effectiveEndEpoch < effectiveStartEpoch) {
    // No overlap at all (interval after period end, before period start, or inverted).
    return { startDay: 1, endDay: 0, daysWorked: 0, daysInMonth: totalDays, prorated: true };
  }

  const startDay = Math.round((effectiveStartEpoch - periodStartEpoch) / DAY_MS) + 1;
  const endDay = Math.round((effectiveEndEpoch - periodStartEpoch) / DAY_MS) + 1;
  const daysWorked = endDay - startDay + 1;
  const prorated = startDay > 1 || endDay < totalDays;

  return { startDay, endDay, daysWorked, daysInMonth: totalDays, prorated };
}

/**
 * Resolves how much of calendar month `year`-`month` was actually worked,
 * given an employment interval `[altaDate?..bajaDate?]`. `null` on either
 * side means "unbounded" on that side (employed before/after the period).
 * Thin delegate over `clipIntervalToMonth` -- kept as its own named export
 * since alta/baja remain the canonical employee-fact prefill source.
 */
export function resolveEffectivePeriod(
  year: number,
  month: number,
  alta: string | null,
  baja: string | null,
): EffectivePeriod {
  return clipIntervalToMonth(year, month, alta, baja);
}

/**
 * Resolves how much of calendar month `year`-`month` overlaps a persisted
 * per-run `[periodStartDate?..periodEndDate?]` range (spec
 * "payroll-run-period-range", design D1). Delegates to the SAME
 * `clipIntervalToMonth` helper as `resolveEffectivePeriod` -- no duplicated
 * day-count logic. Callers (e.g. `calculatePayrollRun`) choose between this
 * and `resolveEffectivePeriod` based on whether a range was supplied; both
 * remain pure with no clock reads.
 */
export function resolveEffectivePeriodFromRange(
  year: number,
  month: number,
  periodStartDate: string | null,
  periodEndDate: string | null,
): EffectivePeriod {
  return clipIntervalToMonth(year, month, periodStartDate, periodEndDate);
}

/** Prorates `fullAmount` by `daysWorked / days`, rounded exactly once (money.ts §4). */
export function proratedAmount(fullAmount: Cents, daysWorked: number, days: number): Cents {
  return multiplyByRatio(fullAmount, daysWorked, days);
}

/**
 * The natural half-year (semester) over which a given month's pagas extra
 * accrues: months 1-6 accrue over H1 (Jan 1 - Jun 30), months 7-12 over H2
 * (Jul 1 - Dec 31). December's end bound is deliberately `Dec 31`, not
 * `Dec 30` -- H2 always has 184 calendar days (92 + 30 + 31 + 31), never 183.
 */
export function semesterBounds(year: number, month: number): { readonly startIso: string; readonly endIso: string; readonly which: 'H1' | 'H2' } {
  if (month >= 1 && month <= 6) {
    return { startIso: `${year}-01-01`, endIso: `${year}-06-30`, which: 'H1' };
  }
  return { startIso: `${year}-07-01`, endIso: `${year}-12-31`, which: 'H2' };
}

/**
 * Calendar-day overlap of the employment interval `[altaDate?..bajaDate?]`
 * with `[startIso..endIso]`, inclusive on both ends. `null` altaDate means
 * "unbounded below" (employed since before `startIso`); `null` bajaDate
 * means "unbounded above". Never negative; 0 when there is no overlap.
 */
export function daysWorkedInInterval(altaDate: string | null, bajaDate: string | null, startIso: string, endIso: string): number {
  const startEpoch = isoToUtcEpoch(startIso);
  const endEpoch = isoToUtcEpoch(endIso);

  const altaEpoch = altaDate === null ? null : isoToUtcEpoch(altaDate);
  const bajaEpoch = bajaDate === null ? null : isoToUtcEpoch(bajaDate);

  const overlapStart = altaEpoch === null ? startEpoch : Math.max(altaEpoch, startEpoch);
  const overlapEnd = bajaEpoch === null ? endEpoch : Math.min(bajaEpoch, endEpoch);

  if (overlapEnd < overlapStart) {
    return 0;
  }
  return Math.round((overlapEnd - overlapStart) / DAY_MS) + 1;
}

/**
 * Computes the pagas extra component for one run, dispatching on
 * `extraPayMode` (design ADR-1 / decision #674):
 * - `EXCLUDE` -- always zero.
 * - `PRORATE` -- each month accrues `baseGross/6`; in a partial month that
 *   monthly accrual is further scaled by the same /30 mes-comercial ratio
 *   used for salary (`SALARY_DEVENGO_DIVISOR`, guarded to a full month's
 *   normalized numerator so a full month always yields exactly `base/6`
 *   regardless of the real day count), folded into a single
 *   `multiplyByRatio` call so there is only one rounding point.
 * - `INCLUDE_IN_MONTH` -- paid as a lump ONLY in June or December, prorated
 *   by the fraction of the accrual semester actually worked (calendar-day
 *   overlap), independent of the run month's own day-count. Any other month
 *   yields zero.
 */
export function resolveExtraPayCents(input: PayrollInput): Cents {
  const { baseGrossCents, periodYear, periodMonth, altaDate, bajaDate, extraPayMode } = input;

  if (extraPayMode === 'EXCLUDE') {
    return cents(0);
  }

  if (extraPayMode === 'PRORATE') {
    const effective = resolveEffectivePeriod(periodYear, periodMonth, altaDate, bajaDate);
    const days = effective.prorated ? effective.daysWorked : SALARY_DEVENGO_DIVISOR;
    return multiplyByRatio(baseGrossCents, days, 6 * SALARY_DEVENGO_DIVISOR);
  }

  // INCLUDE_IN_MONTH: lump only in the accrual-settlement months.
  if (periodMonth !== 6 && periodMonth !== 12) {
    return cents(0);
  }

  const { startIso, endIso } = semesterBounds(periodYear, periodMonth);
  const semesterDaysWorked = daysWorkedInInterval(altaDate, bajaDate, startIso, endIso);
  const semesterTotalDays = daysWorkedInInterval(null, null, startIso, endIso);
  return multiplyByRatio(baseGrossCents, semesterDaysWorked, semesterTotalDays);
}

/**
 * Thin orchestrator: resolves the effective run-month period, prorates base
 * gross by the /30 mes-comercial devengo ratio, computes the worker SS cuota
 * via its own /30 ratio, adds the pagas extra component, and derives the net
 * via one exact subtraction. It also computes the employer's cuota efectiva
 * from the same resolved base; that figure never enters the net.
 *
 * Devengo days-worked normalization (salary AND SS share the same pattern,
 * spec "SS proration decoupled from salary proration" + this change's spec):
 * when the run month is fully worked (`effective.prorated === false`), the
 * days-worked figure is normalized to the divisor itself (30) -- NOT the
 * real `daysInMonth` (28-31) -- so a full month in a 31-day month never
 * overshoots a 31/30 ratio (spec "Full month: divisor is 30/30 ->
 * full-month amount unchanged", any month length). Only a GENUINELY partial
 * period (`prorated === true`) uses the real calendar `daysWorked` count as
 * the numerator, for both salary and SS (spec "Partial July" worked
 * example: 9 días feeds BOTH the salary /30 and the SS /30 ratios with the
 * identical numerator AND denominator -- they share the same ratio on
 * partial months, not just the same numerator). The real calendar
 * `daysInMonth` (28-31) is returned as `PayrollResult.daysInMonth` for the
 * caller to persist, and bounds the month in `clipIntervalToMonth`, but never
 * again acts as a devengo divisor.
 *
 * Zero-days-worked safety (design ADR-2 / spec "Zero-Days-Worked Safety"):
 * when the run month has zero overlapping days,
 * `grossCents`/`ssDeductionCents`/`employerTotalEfectivoCents` safely resolve
 * to zero (never `NaN`/throw) -- but the `INCLUDE_IN_MONTH`
 * semester extra is NOT forced to zero, because it accrues independently of
 * the run month's own day-count.
 */
export function calculatePayrollRun(input: PayrollInput): PayrollResult {
  const { baseGrossCents, ratesConfig, contractType, periodYear, periodMonth, altaDate, bajaDate, periodStartDate, periodEndDate } = input;

  const hasExplicitRange = (periodStartDate ?? periodEndDate ?? null) !== null;
  const effective = hasExplicitRange
    ? resolveEffectivePeriodFromRange(periodYear, periodMonth, periodStartDate ?? null, periodEndDate ?? null)
    : resolveEffectivePeriod(periodYear, periodMonth, altaDate, bajaDate);

  const devengoDays = effective.prorated ? effective.daysWorked : SALARY_DEVENGO_DIVISOR;
  const proratedBaseCents = proratedAmount(baseGrossCents, devengoDays, SALARY_DEVENGO_DIVISOR);
  const ssDaysWorked = effective.prorated ? effective.daysWorked : SS_DIVISOR;
  const workerSs = computeWorkerSs(ratesConfig, baseGrossCents, ssDaysWorked, contractType);
  const ssDeductionCents = workerSs.proratedWorkerSsCents;
  // `*FromBase`, fed the base the worker computation just resolved: the
  // employer anchor must not re-resolve a base of its own.
  const employerSs = computeEmployerSsFromBase(ratesConfig, workerSs.baseCotizacionCents, ssDaysWorked, contractType);
  const extraCents = resolveExtraPayCents(input);

  const grossCents = addCents(proratedBaseCents, extraCents);
  const netCents = subtractCents(grossCents, ssDeductionCents);

  return {
    grossCents,
    ssDeductionCents,
    netCents,
    prorated: effective.prorated,
    extraCents,
    daysWorked: effective.daysWorked,
    daysInMonth: effective.daysInMonth,
    baseCotizacionCents: workerSs.baseCotizacionCents,
    contractType,
    employerTotalEfectivoCents: employerSs.totalEfectivoCents,
  };
}
