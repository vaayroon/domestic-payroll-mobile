/**
 * Pure computed worker Social Security cuota for the Sistema Especial de
 * Empleados de Hogar (CLAUDE.md §5). Replaces manual `fullMonthSsCents` entry
 * with a derivation from a versioned tramo table + worker rates, confirmed
 * against BOE-A-2026-7296 (Orden PJC/297/2026, art. 15 — see engram
 * `payroll/ss-tramos-2026-boe`).
 *
 * NO I/O, NO `Date.now()`. The caller (the form-hook boundary, e.g.
 * `usePayrollRunForm`) resolves the year's `RatesConfig` via
 * `resolveRatesConfig` and injects it into `computeWorkerSs`/the engine — this
 * module never looks up "today's" year itself (design ADR-2: the
 * `year_not_loaded` discriminated union lives at the boundary, never inside
 * the pure math).
 *
 * Rounding discipline (money.ts §4, design ADR-3): every rate component
 * (contingencias comunes, desempleo, MEI) is summed as an exact integer
 * per-10000 rate BEFORE the single `multiplyByRatio` call that produces the
 * cuota. This guarantees ONE rounding point per cuota, avoiding the ±1 cent
 * drift that per-component round-then-sum can introduce.
 */

import type { ContractType } from '@/types/domain';
import { type Cents, cents, multiplyByRatio } from '@/types/money';

export type { ContractType };

/** Worker (trabajador) contribution rates, expressed as integer parts-per-10000 (i.e. `470` = 4,70%). */
export interface WorkerRateComponents {
  readonly ccPer10000: number;
  readonly desempleoPer10000: Record<ContractType, number>;
  readonly meiPer10000: number;
}

/**
 * One row of the "retribución mensual -> base de cotización" tramo table
 * (BOE art. 15.1). `maxRetribucionCents: null` marks the last, open-ended
 * tramo (8º: "desde 1.424,41 €" -- the base becomes the actual retribución,
 * capped separately at `RatesConfig.topeMaxBaseCents`; this tramo's
 * `baseCents` is an unused sentinel, never read by `resolveBaseCotizacion`).
 */
export interface Tramo {
  readonly maxRetribucionCents: Cents | null;
  readonly baseCents: Cents;
}

/** One year's full SS configuration: the tramo table, the tope máximo, and worker rates. */
export interface RatesConfig {
  readonly year: number;
  readonly tramos: readonly Tramo[];
  readonly topeMaxBaseCents: Cents;
  readonly worker: WorkerRateComponents;
}

export type ResolveRatesResult = { readonly ok: true; readonly config: RatesConfig } | { readonly ok: false; readonly reason: 'year_not_loaded' };

/** The computed breakdown for one employee's worker cuota in one payroll run. */
export interface WorkerSsBreakdown {
  /** The base de cotización resolved from the tramo table (before the worker rate is applied). */
  readonly baseCotizacionCents: Cents;
  /** The full-month cuota (no day proration). */
  readonly fullMonthWorkerSsCents: Cents;
  /** The cuota prorated by `daysWorked / SS_DIVISOR` (spec "SS proration decoupled from salary proration"). */
  readonly proratedWorkerSsCents: Cents;
}

/**
 * TGSS treats the base de cotización as a 30-day month regardless of the
 * calendar month's real length (spec "SS proration decoupled from salary
 * proration"). Salary devengo proration now uses the same /30 mes-comercial
 * ratio (see `engine.ts`'s `SALARY_DEVENGO_DIVISOR`), so on partial months
 * salary and SS share the identical `daysWorked/30` ratio -- not just the
 * same numerator. `SALARY_DEVENGO_DIVISOR` and `SS_DIVISOR` are numerically
 * equal by design (guarded by a drift-lock test) but remain distinct named
 * constants because they rest on different legal bases: this one is the
 * TGSS contribution-base convention, `SALARY_DEVENGO_DIVISOR` is a
 * labor-law devengo convention (see its doc-comment in `engine.ts`).
 */
export const SS_DIVISOR = 30;

/**
 * 2026 tramo table + worker rates, confirmed against BOE-A-2026-7296 art. 15
 * (engram `payroll/ss-tramos-2026-boe`, #723). Extend this record with a new
 * year's entry once its BOE order is published and verified; a run whose
 * period year has no entry here resolves to `{ ok: false, reason:
 * 'year_not_loaded' }` via `resolveRatesConfig` rather than silently reusing
 * a stale year's rates.
 */
export const SS_RATES_BY_YEAR: Record<number, RatesConfig> = {
  2026: {
    year: 2026,
    tramos: [
      { maxRetribucionCents: cents(32900), baseCents: cents(30600) }, // 1º: hasta 329,00 -> 306,00
      { maxRetribucionCents: cents(51000), baseCents: cents(43600) }, // 2º: 329,01-510,00 -> 436,00
      { maxRetribucionCents: cents(69300), baseCents: cents(60200) }, // 3º: 510,01-693,00 -> 602,00
      { maxRetribucionCents: cents(87700), baseCents: cents(78500) }, // 4º: 693,01-877,00 -> 785,00
      { maxRetribucionCents: cents(106100), baseCents: cents(97000) }, // 5º: 877,01-1.061,00 -> 970,00
      { maxRetribucionCents: cents(124200), baseCents: cents(115100) }, // 6º: 1.061,01-1.242,00 -> 1.151,00
      { maxRetribucionCents: cents(142440), baseCents: cents(142440) }, // 7º: 1.242,01-1.424,40 -> 1.424,40
      { maxRetribucionCents: null, baseCents: cents(510120) }, // 8º: desde 1.424,41 -> base = retribución real (capped at tope; baseCents unused)
    ],
    topeMaxBaseCents: cents(510120), // 5.101,20 EUR/mes
    worker: {
      ccPer10000: 470, // 4,70%
      desempleoPer10000: { INDEFINIDO: 155, TEMPORAL: 160 }, // 1,55% / 1,60%
      meiPer10000: 15, // 0,15%
    },
  },
};

/** Looks up the `RatesConfig` for a run's period year. Never throws; the caller decides how to handle `year_not_loaded`. */
export function resolveRatesConfig(year: number): ResolveRatesResult {
  const config = SS_RATES_BY_YEAR[year];
  if (config === undefined) {
    return { ok: false, reason: 'year_not_loaded' };
  }
  return { ok: true, config };
}

/**
 * "Retribución mensual" (BOE art. 15) = base gross salary + prorrata de
 * pagas extra, i.e. `baseGrossCents * 14/12` -- ALWAYS, independent of the
 * run's `extraPayMode` (spec "Base de cotización from tramo table": the SS
 * base always includes prorated pagas). One `multiplyByRatio` call, so this
 * is itself a single rounding point.
 */
export function resolveRetribucionCents(baseGrossCents: Cents): Cents {
  return multiplyByRatio(baseGrossCents, 14, 12);
}

/**
 * Maps a resolved retribución to its base de cotización via the tramo table,
 * then caps the result at `topeMaxBaseCents` (spec "Tope máximo cap" --
 * applies regardless of which tramo matched, though in practice only the
 * open-ended 8º tramo can exceed it).
 */
export function resolveBaseCotizacion(
  tramos: readonly Tramo[],
  topeMaxBaseCents: Cents,
  retribucionCents: Cents,
): Cents {
  for (const tramo of tramos) {
    if (tramo.maxRetribucionCents !== null && retribucionCents <= tramo.maxRetribucionCents) {
      return cents(Math.min(tramo.baseCents, topeMaxBaseCents));
    }
  }
  // Open-ended last tramo: the base is the actual retribución, capped at the tope máximo.
  return cents(Math.min(retribucionCents, topeMaxBaseCents));
}

/** The worker's total contribution rate (CC + desempleo + MEI) for a contract type, as an exact integer parts-per-10000 sum. */
export function workerTotalRatePer10000(worker: WorkerRateComponents, contractType: ContractType): number {
  return worker.ccPer10000 + worker.desempleoPer10000[contractType] + worker.meiPer10000;
}

/**
 * Computes one employee's worker SS cuota for a payroll run: resolves the
 * base de cotización from `baseGrossCents`, applies the contract type's
 * total worker rate, and prorates by `daysWorked / SS_DIVISOR` -- all in a
 * SINGLE `multiplyByRatio` call for the prorated figure, so the rate-sum and
 * the day-proration share one rounding point (design ADR-3 rounding proof:
 * base 1.424,50€ INDEFINIDO full-month -> 91,17€; same base, 9/30 días ->
 * 27,35€).
 */
export function computeWorkerSs(
  config: RatesConfig,
  baseGrossCents: Cents,
  daysWorked: number,
  contractType: ContractType,
): WorkerSsBreakdown {
  const retribucionCents = resolveRetribucionCents(baseGrossCents);
  const baseCotizacionCents = resolveBaseCotizacion(config.tramos, config.topeMaxBaseCents, retribucionCents);
  const ratePer10000 = workerTotalRatePer10000(config.worker, contractType);

  const fullMonthWorkerSsCents = multiplyByRatio(baseCotizacionCents, ratePer10000, 10000);
  const proratedWorkerSsCents = multiplyByRatio(baseCotizacionCents, ratePer10000 * daysWorked, 10000 * SS_DIVISOR);

  return { baseCotizacionCents, fullMonthWorkerSsCents, proratedWorkerSsCents };
}
