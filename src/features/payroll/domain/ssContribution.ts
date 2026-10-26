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
 *
 * The employer side (`computeEmployerSs`) follows a DIFFERENT discipline on
 * purpose, because it has a different job: its figures are printed row by row
 * and must each be reproducible from the row beside them. See
 * `computeEmployerSs` for the algorithm and the two excluded alternatives.
 */

import type { ContractType } from '@/types/domain';
import { addCents, type Cents, cents, multiplyByRatio, subtractCents } from '@/types/money';

export type { ContractType };

/** Worker (trabajador) contribution rates, expressed as integer parts-per-10000 (i.e. `470` = 4,70%). */
export interface WorkerRateComponents {
  readonly ccPer10000: number;
  readonly desempleoPer10000: Record<ContractType, number>;
  readonly meiPer10000: number;
}

/**
 * Employer (empleador) contribution rates, expressed as integer
 * parts-per-10000 (i.e. `2360` = 23,60%). NOMINAL rates only.
 *
 * Effective rates (the nominal rate net of a benefit, e.g. contingencias
 * comunes at 18,88 %) are deliberately NOT modelled and must never become a
 * constant, however inviting the reference table in engram
 * `payroll/at-ep-tarifa-2026-boe` looks. Summing individually-rounded
 * effective rows yields 317,24 on the TGSS golden vector where the official
 * document prints 317,23 (excluded algorithm "R-C"). See `computeEmployerSs`.
 */
export interface EmployerRateComponents {
  /** Contingencias comunes, employer share. */
  readonly ccPer10000: number;
  /** Contingencias profesionales (AT y EP), employer only. A single constant for CNAE-2025 code 97 (hogares). */
  readonly atEpPer10000: number;
  /** Desempleo, employer share; depends on the contract type. */
  readonly desempleoPer10000: Record<ContractType, number>;
  /** FOGASA, employer only. */
  readonly fogasaPer10000: number;
  /** MEI (Mecanismo de Equidad Intergeneracional), employer share. No benefit is permitted on it. */
  readonly meiPer10000: number;
  /** The employer benefits applicable to the rows above. */
  readonly beneficios: EmployerBenefitRates;
}

/**
 * Employer benefits on the cuota, as integer percent. Only the 20 % / 80 %
 * route of RD-ley 16/2022 DA 1ª apartado 1 is modelled; the 45 % / 30 % route
 * (DA 1ª apartado 2) and the familia-numerosa route are a known limitation.
 */
export interface EmployerBenefitRates {
  /** Reducción on the employer contingencias comunes cuota. */
  readonly reduccionCcPercent: number;
  /** Bonificación on the employer desempleo + FOGASA cuotas. */
  readonly bonificacionDesempleoFogasaPercent: number;
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

/** One year's full SS configuration: the tramo table, the tope máximo, and worker and employer rates. */
export interface RatesConfig {
  readonly year: number;
  readonly tramos: readonly Tramo[];
  readonly topeMaxBaseCents: Cents;
  readonly worker: WorkerRateComponents;
  readonly employer: EmployerRateComponents;
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
 * The computed breakdown of one employer contribution for one payroll run.
 *
 * A flat record of named `Cents` fields (not rows): the domain knows no
 * Spanish labels and no display order, so the receipt layer owns both.
 *
 * Sign convention: every amount here is a POSITIVE magnitude, including the
 * two benefits. The receipt layer owns the minus sign.
 *
 * There is intentionally NO per-component effective field (for example no
 * `contingenciasComunesEfectivaCents`). The only effective quantity is
 * `totalEfectivoCents`, reachable solely as nominal total minus the two
 * rounded benefits. That makes the excluded "R-C" algorithm unrepresentable.
 */
export interface EmployerSsBreakdown {
  /** The base de cotización resolved from the tramo table, full month and unprorated. */
  readonly baseCotizacionCents: Cents;
  /** The base prorated by `daysWorked / SS_DIVISOR`; the operand each nominal row is a percentage of. */
  readonly basePeriodoCents: Cents;
  readonly contingenciasComunesCents: Cents;
  readonly atEpCents: Cents;
  readonly desempleoCents: Cents;
  readonly fogasaCents: Cents;
  readonly meiCents: Cents;
  /** Exact sum of the five rounded rows above. */
  readonly totalNominalCents: Cents;
  /** Desempleo + FOGASA (the rounded rows): the operand of the bonificación. A cuota, not a base. */
  readonly cuotaBaseBonificacionCents: Cents;
  /** Reducción on contingencias comunes. POSITIVE magnitude. */
  readonly reduccionCcCents: Cents;
  /** Bonificación on desempleo + FOGASA. POSITIVE magnitude. */
  readonly bonificacionDesempleoFogasaCents: Cents;
  /** Nominal total minus both benefits, exact. */
  readonly totalEfectivoCents: Cents;
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
    // Employer rates. Each value cites its norm by BOE id (engram
    // `payroll/ss-employer-2026-boe`, `payroll/at-ep-tarifa-2026-boe`).
    employer: {
      // Contingencias comunes 23,60%: Orden PJC/297/2026 (BOE-A-2026-7296) art. 15.3.
      ccPer10000: 2360,
      // AT y EP 1,50%: tarifa de primas, TRLGSS DA 61ª as worded by RDL 3/2026
      // (BOE-A-2026-2548) DF 1ª apartado Tres, Cuadro I, CNAE-2025 row 97.
      // Confirmed against an official TGSS recibo (21,37 EUR on base 1.424,50).
      // DA 61ª apartado 4 lets the Government adjust the tarifa annually, so a
      // future year needs its own citation; never copy this value forward.
      atEpPer10000: 150,
      // Desempleo 5,50% INDEFINIDO / 6,70% TEMPORAL: Orden PJC/297/2026 art. 35.
      desempleoPer10000: { INDEFINIDO: 550, TEMPORAL: 670 },
      // FOGASA 0,20%, employer only: Orden PJC/297/2026 art. 35.
      fogasaPer10000: 20,
      // MEI 0,75% employer: Orden PJC/297/2026 art. 16. No benefit is permitted
      // on it (TRLGSS art. 127 bis.2), so it never enters a benefit operand.
      meiPer10000: 75,
      // RD-ley 16/2022 (BOE-A-2022-14680) DA 1ª apartado 1. AT y EP gets no
      // benefit: DA 1ª does not mention it.
      beneficios: {
        reduccionCcPercent: 20, // on employer contingencias comunes
        bonificacionDesempleoFogasaPercent: 80, // on employer desempleo + FOGASA
      },
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

/**
 * The base de cotización for a monthly gross salary: retribución (gross x14/12)
 * mapped through the tramo table and capped. The single path from a salary to
 * a base -- every caller that has only a salary goes through here, so there is
 * one resolution and one place to change it.
 */
export function resolveBaseCotizacionForGross(config: RatesConfig, baseGrossCents: Cents): Cents {
  return resolveBaseCotizacion(config.tramos, config.topeMaxBaseCents, resolveRetribucionCents(baseGrossCents));
}

/**
 * The decomposition of a persisted base de cotización into the annex's
 * `Importe remuneración mensual` + `Importe prorrata pagas extraordinarias`.
 *
 * A union, not a record with zeros: the non-decomposable variant is unable to
 * carry amounts, so "cannot decompose" can never be mistaken for "decomposes
 * into nothing".
 */
export type BaseCotizacionDesglose =
  | {
      readonly kind: 'decomposable';
      readonly remuneracionMensualCents: Cents;
      readonly prorrataPagasCents: Cents;
      /** Always the base that was passed in. */
      readonly totalCents: Cents;
    }
  | {
      readonly kind: 'not_decomposable';
      /** `tramo_base`: the base came from a fixed tramo. `tope_maximo`: the base sits on the cap. */
      readonly reason: 'tramo_base' | 'tope_maximo';
    };

/**
 * The retribución ceiling of the last CLOSED tramo of the table (142440 in
 * 2026), read from the config so no year's literal is hardcoded. Every base
 * at or below it may have come from a fixed tramo; above it the base is the
 * retribución itself. Not exported on purpose: it returns a number, never a
 * decision, so the decision stays in `resolveBaseCotizacionDesglose`.
 *
 * A table with no closed tramo has no ceiling to exceed: every base is the
 * retribución, so the ceiling is zero.
 */
function lastClosedTramoCeilingCents(tramos: readonly Tramo[]): Cents {
  for (let index = tramos.length - 1; index >= 0; index -= 1) {
    const { maxRetribucionCents } = tramos[index] as Tramo;
    if (maxRetribucionCents !== null) {
      return maxRetribucionCents;
    }
  }
  return cents(0);
}

/**
 * Decomposes a PERSISTED base de cotización (`PayrollRun.baseCotizacionCents`)
 * into the annex's remuneración mensual + prorrata de pagas extraordinarias,
 * where, and only where, that is true.
 *
 * In the Sistema Especial the base comes from the tramo scale; it equals the
 * retribución only in the open-ended last tramo. So:
 *   - `base <= ` the last closed tramo's ceiling: the base may be a fixed tramo
 *     value, not a retribución -> `not_decomposable` / `tramo_base`.
 *   - `base >= topeMaxBaseCents`: a capped base is indistinguishable from an
 *     uncapped one of exactly the tope -> `not_decomposable` / `tope_maximo`.
 *     The tope is checked first.
 *   - otherwise the base IS the retribución (gross x 14/12), so
 *     `remuneración = base x 12/14` and `prorrata = base - remuneración`.
 *
 * `remuneracionMensualCents` is the arithmetic inverse of
 * `resolveRetribucionCents`: it reproduces the period's monthly gross to
 * within the one cent that function may have rounded. It is the single new
 * rounding point; the prorrata is an exact subtraction, so the two always add
 * back to the base. NEVER reconcile it against `employee.baseGrossCents`: the
 * salary may have changed since the run, and comparing against it is the
 * reprint-drift defect returning as a "sanity check".
 *
 * This is the only entry point on purpose. Exporting the decomposability test
 * or the 12/14 split separately would let a caller split without checking.
 */
export function resolveBaseCotizacionDesglose(config: RatesConfig, baseCotizacionCents: Cents): BaseCotizacionDesglose {
  if (baseCotizacionCents >= config.topeMaxBaseCents) {
    return { kind: 'not_decomposable', reason: 'tope_maximo' };
  }
  if (baseCotizacionCents <= lastClosedTramoCeilingCents(config.tramos)) {
    return { kind: 'not_decomposable', reason: 'tramo_base' };
  }

  const remuneracionMensualCents = multiplyByRatio(baseCotizacionCents, 12, 14);
  return {
    kind: 'decomposable',
    remuneracionMensualCents,
    prorrataPagasCents: subtractCents(baseCotizacionCents, remuneracionMensualCents),
    totalCents: baseCotizacionCents,
  };
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
  return computeWorkerSsFromBase(config, resolveBaseCotizacionForGross(config, baseGrossCents), daysWorked, contractType);
}

/**
 * The same computation as `computeWorkerSs` starting from an ALREADY-RESOLVED
 * base de cotización, for callers holding a base that must not be re-derived
 * from a salary -- a receipt reprinting a past period from the base that
 * period was actually computed with (`PayrollRun.baseCotizacionCents`).
 *
 * `computeWorkerSs` is a wrapper over this, so the tramo/tope resolution lives
 * in exactly one place and the two entry points cannot drift apart.
 */
export function computeWorkerSsFromBase(
  config: RatesConfig,
  baseCotizacionCents: Cents,
  daysWorked: number,
  contractType: ContractType,
): WorkerSsBreakdown {
  const ratePer10000 = workerTotalRatePer10000(config.worker, contractType);

  const fullMonthWorkerSsCents = multiplyByRatio(baseCotizacionCents, ratePer10000, 10000);
  const proratedWorkerSsCents = multiplyByRatio(baseCotizacionCents, ratePer10000 * daysWorked, 10000 * SS_DIVISOR);

  return { baseCotizacionCents, fullMonthWorkerSsCents, proratedWorkerSsCents };
}

/**
 * R-B2, display-source: a benefit is a percentage of the ALREADY-ROUNDED cuota
 * row(s) printed above it, never of an unrounded intermediate. The `Cents`
 * parameter type is the guard: an exact-source operand is not a `Cents` value
 * and could only be expressed by folding the rates into one numerator, which is
 * the formula quarantined in the test file.
 *
 * The TGSS golden vector does NOT discriminate this from the exact-source
 * reading (R-B1); two inputs do, and both are pinned in the tests: a 9/30
 * partial month (official TGSS figures, bonificación 19,48 not 19,49) and the
 * tope máximo (232,62 not 232,61).
 *
 * Both benefit rows MUST call this. Do not inline the multiplication.
 */
export function applyBenefitPercent(cuotaAfectadaCents: Cents, percent: number): Cents {
  return multiplyByRatio(cuotaAfectadaCents, percent, 100);
}

/**
 * Computes one employer's contribution for a payroll run (the receipt's
 * "determinación de bases y cuotas" block). It shares the base de cotización
 * with the worker side: same retribución, same tramo table, same tope.
 *
 * Algorithm "R-B" (bottom-up), in this order and no other:
 *   1. Each of the five nominal rows is ONE `multiplyByRatio` of
 *      `base x rate x days / 30`, never a rounded full-month row times days.
 *   2. The nominal total is the exact sum of those ALREADY-ROUNDED rows.
 *   3. Both benefits go through `applyBenefitPercent` on the rounded rows
 *      (R-B2, see its doc comment).
 *   4. The effective total is the nominal total minus the two rounded
 *      benefits, an exact subtraction.
 *
 * Why: every printed figure is reproducible with a calculator from the row
 * beside it, and the result matches an official TGSS recibo to the cent
 * (base 1.424,50 INDEFINIDO: 449,43 - 67,24 - 64,96 = 317,23).
 *
 * Two alternatives are excluded and must not be reintroduced:
 *   - R-C: rounding each row at its EFFECTIVE rate and summing gives 317,24,
 *     one cent off the official document. Hence no effective rate or effective
 *     row exists anywhere in this module.
 *   - R-A: carrying full precision to a single final rounding folds the rates
 *     into one numerator and forces some printed row to contradict its own
 *     stated rate. That formula lives only in the test file, as a drift lock.
 * The effective total can differ from the ideal single-rounded product by 1-2
 * cents. This is accepted: nothing here is persisted or remitted by the app.
 *
 * Days are normalised like the worker side (the caller passes `SS_DIVISOR`
 * for a non-prorated run, even in a 31-day month).
 */
export function computeEmployerSs(
  config: RatesConfig,
  baseGrossCents: Cents,
  daysWorked: number,
  contractType: ContractType,
): EmployerSsBreakdown {
  return computeEmployerSsFromBase(config, resolveBaseCotizacionForGross(config, baseGrossCents), daysWorked, contractType);
}

/**
 * The same computation as `computeEmployerSs` starting from an
 * ALREADY-RESOLVED base de cotización -- see `computeWorkerSsFromBase` for
 * why both entry points exist. `computeEmployerSs` is a wrapper over this.
 */
export function computeEmployerSsFromBase(
  config: RatesConfig,
  baseCotizacionCents: Cents,
  daysWorked: number,
  contractType: ContractType,
): EmployerSsBreakdown {
  const basePeriodoCents = multiplyByRatio(baseCotizacionCents, daysWorked, SS_DIVISOR);
  const { employer } = config;

  const nominalRow = (ratePer10000: number): Cents =>
    multiplyByRatio(baseCotizacionCents, ratePer10000 * daysWorked, 10000 * SS_DIVISOR);

  const contingenciasComunesCents = nominalRow(employer.ccPer10000);
  const atEpCents = nominalRow(employer.atEpPer10000);
  const desempleoCents = nominalRow(employer.desempleoPer10000[contractType]);
  const fogasaCents = nominalRow(employer.fogasaPer10000);
  const meiCents = nominalRow(employer.meiPer10000);

  const totalNominalCents = [atEpCents, desempleoCents, fogasaCents, meiCents].reduce(addCents, contingenciasComunesCents);

  const cuotaBaseBonificacionCents = addCents(desempleoCents, fogasaCents);
  const reduccionCcCents = applyBenefitPercent(contingenciasComunesCents, employer.beneficios.reduccionCcPercent);
  const bonificacionDesempleoFogasaCents = applyBenefitPercent(
    cuotaBaseBonificacionCents,
    employer.beneficios.bonificacionDesempleoFogasaPercent,
  );

  const totalEfectivoCents = subtractCents(subtractCents(totalNominalCents, reduccionCcCents), bonificacionDesempleoFogasaCents);

  return {
    baseCotizacionCents,
    basePeriodoCents,
    contingenciasComunesCents,
    atEpCents,
    desempleoCents,
    fogasaCents,
    meiCents,
    totalNominalCents,
    cuotaBaseBonificacionCents,
    reduccionCcCents,
    bonificacionDesempleoFogasaCents,
    totalEfectivoCents,
  };
}
