/**
 * Pure builder for the receipt view-model (design ADR-3). NO I/O, NO clock
 * read inside -- the issue date is injected by the caller (the screen layer
 * reads "today" and passes it in, per CLAUDE.md §3/§5). Itemization is
 * RECONSTRUCTED from the persisted `PayrollRun` fields (never re-run through
 * the calculation engine): `salarioBaseCents = grossCents - extraCents`.
 *
 * Deducciones intentionally cover only the worker's own SS quota
 * (`ssDeductionCents`) -- IRPF withholding does not apply to this regime.
 */

import { formatEuros } from '../screens/formatEuros';
import { formatSpanishDate, formatSpanishMonthYear } from '../formatSpanishDate';
import type { ContractType, Employee, Employer, PayrollRun } from '@/types';
import { type Cents, multiplyByRatio, subtractCents } from '@/types/money';

import {
  computeEmployerSsFromBase,
  computeWorkerSsFromBase,
  resolveBaseCotizacionDesglose,
  resolveBaseCotizacionForGross,
  SS_DIVISOR,
  type EmployerSsBreakdown,
  type RatesConfig,
} from '../domain/ssContribution';
import {
  GRUPO_PROFESIONAL,
  type ReceiptBaseCotizacion,
  type ReceiptDeduccionDesglose,
  type ReceiptEmpleadorCotizacion,
  type ReceiptLineItem,
  type ReceiptViewModel,
} from './ReceiptViewModel';

const PLACEHOLDER = '—';

export interface BuildReceiptViewModelInput {
  readonly run: PayrollRun;
  readonly employee: Employee;
  readonly employer: Employer;
  /** ISO `'YYYY-MM-DD'` issue date, injected -- never read from a system clock here. */
  readonly issuedOnIso: string;
  /**
   * The run period year's resolved SS rates/tramo table, resolved at the
   * `useReceiptGenerator` boundary via `resolveRatesConfig` (never read
   * inside this pure builder). `null` when the year's rates are unavailable
   * -- `deduccionesDesglose` degrades to empty and callers fall back to the
   * single lump `deducciones` line (today's behavior), no crash.
   */
  readonly ratesConfig: RatesConfig | null;
  /** Bare base64 PNG (NO `data:` prefix) of the employer's saved signature, or `null` when none is saved. Required (not optional) so the strict compiler enumerates every call site (design ADR-5). */
  readonly employerSignatureBase64: string | null;
}

/** Formats an integer parts-per-10000 rate as a Spanish percentage string, e.g. `470` -> `"4,70 %"`. */
function formatRatePercent(per10000: number): string {
  return `${(per10000 / 100).toFixed(2).replace('.', ',')} %`;
}

/** Formats an integer percent as a Spanish percentage string, e.g. `20` -> `"20 %"`. */
function formatPercent(percent: number): string {
  return `${percent} %`;
}

/**
 * Formats a POSITIVE benefit magnitude as a negative amount, e.g. `6724` ->
 * `"-67,24 €"`. The one place the minus sign is applied: the domain carries
 * positive magnitudes and the receipt layer owns the sign. Zero stays unsigned
 * so a zero-day run never prints `"-0,00 €"`.
 */
function formatNegativeEuros(magnitude: Cents): string {
  return magnitude === 0 ? formatEuros(magnitude) : `-${formatEuros(magnitude)}`;
}

/** Extracts the 1-based day-of-month from an ISO `'YYYY-MM-DD'` string. */
function dayOfMonth(iso: string): number {
  return Number(iso.split('-')[2]);
}

/**
 * SS days-worked normalization, mirroring the engine (engine.ts:
 * `calculatePayrollRun`) -- a full month normalizes to SS_DIVISOR itself,
 * never the real calendar `daysInMonth`.
 *
 * Shared by the worker desglose, the employer block and the drift detector so
 * that the detector normalizes exactly like the figures it checks: a detector
 * that normalized differently would report phantom drift.
 */
function resolveSsDaysWorked(run: PayrollRun): number {
  return run.prorated ? run.daysWorked : SS_DIVISOR;
}

/**
 * The cotización inputs this receipt must be computed from: the run's own
 * anchors when it has them, the employee's current values when it does not.
 *
 * This is the repair. The receipt used to derive both from
 * `employee.baseGrossCents`/`employee.contractType` AS THEY ARE AT PRINT TIME,
 * so editing a salary silently reprinted an older period with the wrong base.
 * A run created from the anchor change onward carries the base and contract
 * type it was actually computed with, and reprints from those.
 *
 * Runs saved before those columns existed hold `null` (no backfill) and fall
 * back to today's behavior -- per input, since a column is null or it is not.
 *
 * Resolved ONCE in `buildReceiptViewModel` and threaded into the worker
 * desglose, the employer block and the drift detector, so all three provably
 * agree. Resolving independently in each is precisely the bug this prevents.
 */
interface ResolvedCotizacionInputs {
  readonly baseCotizacionCents: Cents;
  readonly contractType: ContractType;
}

function resolveCotizacionInputs(run: PayrollRun, employee: Employee, ratesConfig: RatesConfig): ResolvedCotizacionInputs {
  return {
    baseCotizacionCents: run.baseCotizacionCents ?? resolveBaseCotizacionForGross(ratesConfig, employee.baseGrossCents),
    contractType: run.contractType ?? employee.contractType,
  };
}

/**
 * Per-contingency breakdown of the worker's SS cuota (contingencias comunes /
 * desempleo / MEI), reconciled to the persisted `ssDeductionCents` via
 * residual-on-largest-line (design "Cuota reconciliation"): the two smaller
 * components (desempleo, MEI) are computed with the SAME proration ratio the
 * engine used, then contingencias comunes absorbs whatever residual remains
 * so the column always foots exactly to the authoritative persisted total --
 * never independently re-rounded into a ±1-2 cent drift.
 *
 * The residual is meant to be a ROUNDING reconciliation, at most a cent or two.
 * It used to do double duty, silently absorbing base drift as well whenever the
 * employee's salary had moved since the run -- an arbitrary amount, invisible
 * on the page. For an ANCHORED run that is now fixed: the rows and the
 * persisted total come from the same base, so only the rounding is left.
 *
 * Three cases still absorb more than rounding, all pre-existing and none made
 * worse here:
 *   - A pre-anchor run (null columns) whose employee has since been edited.
 *   - Any run, anchored or not, after a WORKER rate in `SS_RATES_BY_YEAR` is
 *     corrected for that year: the `tipo` column prints the current rate while
 *     the cuota is reconciled to the old persisted total, so rate x base no
 *     longer reproduces the printed figure.
 *   - A legacy run (`daysInMonth === 0`) whose persisted cuota was typed by
 *     hand rather than computed, so the rows and the total never shared a
 *     source: the residual absorbs an arbitrary difference, with no edit to
 *     the employee needed. `resolveBaseDriftStatus` rule 2 is that same
 *     population, and suppresses the employer block for it.
 * Where the employer block can tell, it suppresses itself (see
 * `resolveBaseDriftStatus`); these worker rows never do.
 */
function computeDeduccionesDesglose(
  run: PayrollRun,
  cotizacion: ResolvedCotizacionInputs,
  ratesConfig: RatesConfig,
): readonly ReceiptDeduccionDesglose[] {
  const { baseCotizacionCents, contractType } = cotizacion;

  const ssDaysWorked = resolveSsDaysWorked(run);

  const desempleoPer10000 = ratesConfig.worker.desempleoPer10000[contractType];
  const meiPer10000 = ratesConfig.worker.meiPer10000;

  const desempleoCuotaCents = multiplyByRatio(baseCotizacionCents, desempleoPer10000 * ssDaysWorked, 10000 * SS_DIVISOR);
  const meiCuotaCents = multiplyByRatio(baseCotizacionCents, meiPer10000 * ssDaysWorked, 10000 * SS_DIVISOR);
  const contingenciasComunesCuotaCents = subtractCents(subtractCents(run.ssDeductionCents, desempleoCuotaCents), meiCuotaCents);

  // Operative base for the period: baseCotización prorated by the SAME
  // ssDaysWorked/SS_DIVISOR ratio used for the cuotas above, so basePeriodo
  // x tipo reconciles to cuota on partial months. A distinct rounding point
  // from the cuota calculations (R5: still single-rounding per amount).
  const basePeriodoCents = multiplyByRatio(baseCotizacionCents, ssDaysWorked, SS_DIVISOR);

  const baseMensualDisplay = formatEuros(baseCotizacionCents);
  const basePeriodoDisplay = formatEuros(basePeriodoCents);

  return [
    {
      concepto: 'Contingencias comunes',
      baseMensual: baseMensualDisplay,
      basePeriodo: basePeriodoDisplay,
      tipo: formatRatePercent(ratesConfig.worker.ccPer10000),
      cuota: formatEuros(contingenciasComunesCuotaCents),
    },
    {
      concepto: 'Desempleo',
      baseMensual: baseMensualDisplay,
      basePeriodo: basePeriodoDisplay,
      tipo: formatRatePercent(desempleoPer10000),
      cuota: formatEuros(desempleoCuotaCents),
    },
    {
      concepto: 'MEI (Mecanismo de Equidad Intergeneracional)',
      baseMensual: baseMensualDisplay,
      basePeriodo: basePeriodoDisplay,
      tipo: formatRatePercent(meiPer10000),
      cuota: formatEuros(meiCuotaCents),
    },
  ];
}

/**
 * The employer SS breakdown this receipt is computed from: the resolved
 * cotización inputs and the SS days normalization, fed to the pure domain
 * function.
 *
 * The one place THIS MODULE writes that argument list. The drift detector
 * checks `run.employerTotalEfectivoCents` against this and the employer block
 * prints from it, so the figure that is verified and the figure that is
 * printed are the same figure.
 *
 * `engine.ts` writes its own call to produce the stored figure at payroll
 * time. The two are not unified today.
 */
function computeReceiptEmployerSs(
  run: PayrollRun,
  cotizacion: ResolvedCotizacionInputs,
  ratesConfig: RatesConfig,
): EmployerSsBreakdown {
  return computeEmployerSsFromBase(ratesConfig, cotizacion.baseCotizacionCents, resolveSsDaysWorked(run), cotizacion.contractType);
}

type BaseDriftStatus = 'verified' | 'drifted' | 'not_verifiable';

/**
 * Reprint drift detector: does the receipt's own recompute still agree with
 * the persisted figures it can be checked against -- always the worker cuota
 * `run.ssDeductionCents`, and also the employer cuota efectiva
 * `run.employerTotalEfectivoCents` when the run carries it?
 *
 * ONE formulation, whose meaning narrows as anchors become available, because
 * it always recomputes from `cotizacion` -- the resolved inputs, anchors
 * preferred:
 *
 *   - **Anchored run**: base and contract type come from the run itself, so a
 *     later salary or contract edit cannot move the recompute. What stays
 *     detectable is a change to the WORKER side of `SS_RATES_BY_YEAR` for an
 *     already-run year -- an inconsistency an anchor cannot fix, and a real
 *     one: the printed figures would no longer match what was filed. A run that
 *     also carries the employer anchor extends this to the EMPLOYER side, up to
 *     the limit described below.
 *
 *   - **Pre-anchor run** (either column null): the inputs fall back to the
 *     employee's current values, so this remains the original indirect check,
 *     the only drift signal those rows have.
 *
 * The worker comparison alone has a blind spot on exactly the figures this
 * block prints: `run.ssDeductionCents` is a WORKER total, so correcting an
 * EMPLOYER rate for an already-run year leaves it matching and the employer
 * rows reprint silently at the new rates. A run carrying
 * `employerTotalEfectivoCents` narrows that -- its own employer figure is
 * checked the same way, against a recompute at today's rates. The anchor is a
 * SINGLE rounded scalar, so the check detects any correction that MOVES the
 * rounded cuota efectiva, and nothing else. Two residuals remain: a correction
 * whose effect rounds away at the total (most plausibly on a very short
 * partial-month run), and offsetting corrections across components that cancel
 * in the total. A zero-day run anchors 0 and recomputes 0, so it can never
 * detect anything; that is harmless, since such a receipt prints zero cuotas
 * anyway, but it is agreement, not detection. A run without the anchor keeps
 * the worker check alone and the full blind spot it has always had.
 *
 * Those two residuals are not a weakness of the employer side specifically.
 * `run.ssDeductionCents` is one rounded scalar over a SUMMED rate, so the
 * worker comparison above is limited the same way and always has been; it is
 * spelled out here rather than beside it only because this is where a reader
 * asks the question.
 *
 * A salary edit no longer produces a note on an anchored run, and that is the
 * point, not an oversight: the reprint is now reproduced from its own period
 * and is correct. Flagging it would be the repaired defect returning as a
 * caution label.
 *
 * The fallback path's apparent false negatives are true negatives, not luck.
 * `resolveBaseCotizacion` maps a RANGE of retribución to one base twice over:
 * tramos 1-7 each map their whole range to a FIXED base, and every result is
 * then capped at `topeMaxBaseCents`. So a salary edit within a single tramo --
 * or between two retribuciones that BOTH exceed the tope, the open-ended 8º
 * tramo included -- resolves to the same base, and the reprint it produces is
 * still the correct one. An edit that does move the resolved base is caught
 * when it moves the rounded cuota, under the single-scalar limits above.
 *
 * Rules, evaluated in this order:
 *   1. No `RatesConfig`, hence no resolved `cotizacion`: nothing to recompute
 *      with. The two are guarded together because they arrive together --
 *      `buildReceiptViewModel` resolves `cotizacion` only when it has a
 *      config.
 *   2. `daysInMonth === 0`: a provable legacy run. The engine never emits 0
 *      (always 28-31), so this is a pre-migration-0002 row backfilled to 0,
 *      whose persisted cuota was typed by hand and never came from
 *      `computeWorkerSs` at all. The comparison would be meaningless, not
 *      merely wrong -- and it stays meaningless however the base is resolved,
 *      so this guard runs BEFORE any recompute and outranks any anchor.
 *   3. Persisted cuota 0 while the recompute is positive: every tramo has a
 *      positive base, so a zero persisted cuota is an absent input.
 *   4. Worker recompute unequal to the persisted cuota: drifted.
 *   5. Employer anchor present and unequal to its recompute: drifted. A zero
 *      anchor is NOT treated as absent the way rule 3 treats a zero cuota: a
 *      zero-day run really does cost the employer nothing, and such a run
 *      recomputes to zero as well, so the two still agree.
 *   6. Otherwise: verified.
 *
 * A residual band of manual-era runs (typed cuota, but real day data) still
 * falls to `drifted`. Their worker cuota came from a different source than the
 * block below it, so "does not match" remains true.
 */
function resolveBaseDriftStatus(
  run: PayrollRun,
  cotizacion: ResolvedCotizacionInputs | null,
  ratesConfig: RatesConfig | null,
): BaseDriftStatus {
  if (ratesConfig === null || cotizacion === null) {
    return 'not_verifiable';
  }
  if (run.daysInMonth === 0) {
    return 'not_verifiable';
  }

  const recomputedWorkerSsCents = computeWorkerSsFromBase(
    ratesConfig,
    cotizacion.baseCotizacionCents,
    resolveSsDaysWorked(run),
    cotizacion.contractType,
  ).proratedWorkerSsCents;

  if (run.ssDeductionCents === 0 && recomputedWorkerSsCents > 0) {
    return 'not_verifiable';
  }
  if (recomputedWorkerSsCents !== run.ssDeductionCents) {
    return 'drifted';
  }

  if (run.employerTotalEfectivoCents !== null) {
    // The same helper `buildEmpleadorCotizacion` prints from, so what is
    // checked here is what would be printed there.
    const recomputedEmployerTotalCents = computeReceiptEmployerSs(run, cotizacion, ratesConfig).totalEfectivoCents;

    if (recomputedEmployerTotalCents !== run.employerTotalEfectivoCents) {
      return 'drifted';
    }
  }

  return 'verified';
}

const NOTA_TIPOS_NO_DISPONIBLES =
  'No se ha podido determinar la cotización a cargo de la parte empleadora porque no están disponibles los tipos de cotización del año de este período. Este recibo refleja únicamente los devengos y las deducciones de la persona trabajadora.';

// Both notes below replace the rows and totals, they do not accompany them: a
// run whose base cannot be trusted shows no employer figure at all.
// Wording covers both paths this note now serves: an anchored run whose YEAR
// RATES have since been corrected, and a pre-anchor run whose base has moved.
// Naming only the base would be false for the first.
const NOTA_BASE_DESAJUSTADA =
  'No se muestran las cifras de cotización a cargo de la parte empleadora porque los datos de cotización actuales no coinciden con los utilizados en la liquidación de este período. Consulte la liquidación original.';

const NOTA_BASE_NO_COMPROBABLE =
  'Este período no permite comprobar la base de cotización utilizada en su día, por lo que no se muestran las cifras de cotización a cargo de la parte empleadora.';

const NOTA_BASE_POR_TRAMO =
  'La base de cotización de este período procede del tramo de retribución que le corresponde en la escala del Sistema Especial para Empleados de Hogar, por lo que no coincide con la retribución mensual y no se desglosa en remuneración y prorrata de pagas extraordinarias.';

const NOTA_BASE_EN_TOPE_MAXIMO =
  'La base de cotización de este período coincide con el tope máximo de cotización, por lo que no es posible determinar si corresponde a la retribución mensual íntegra y no se desglosa.';

/**
 * The annex's base de cotización decomposition for a VERIFIED run. Decomposes
 * the full-month base the receipt already resolved from the run's own anchor
 * (`ResolvedCotizacionInputs`), never the prorated `basePeriodo` and never the
 * employee's current salary: reading `employee.baseGrossCents` here would
 * reprint an old period from today's pay, the drift the anchor exists to stop.
 */
function buildBaseCotizacion(baseCotizacionCents: Cents, ratesConfig: RatesConfig): ReceiptBaseCotizacion {
  const desglose = resolveBaseCotizacionDesglose(ratesConfig, baseCotizacionCents);

  if (desglose.kind === 'not_decomposable') {
    return desglose.reason === 'tope_maximo'
      ? { kind: 'no_desglosable', motivo: 'base_en_tope_maximo', nota: NOTA_BASE_EN_TOPE_MAXIMO }
      : { kind: 'no_desglosable', motivo: 'base_por_tramo', nota: NOTA_BASE_POR_TRAMO };
  }

  return {
    kind: 'desglosada',
    remuneracionMensual: formatEuros(desglose.remuneracionMensualCents),
    prorrataPagasExtraordinarias: formatEuros(desglose.prorrataPagasCents),
    total: formatEuros(desglose.totalCents),
  };
}

/**
 * Employer "determinación de bases y cuotas" block: maps the flat
 * `EmployerSsBreakdown` record from `computeReceiptEmployerSs` to ordered,
 * labelled rows (the domain knows no labels or order). Only a verified run
 * gets figures; every other state yields a note and no figures.
 */
function buildEmpleadorCotizacion(
  run: PayrollRun,
  cotizacion: ResolvedCotizacionInputs | null,
  ratesConfig: RatesConfig | null,
): ReceiptEmpleadorCotizacion {
  if (ratesConfig === null || cotizacion === null) {
    return { kind: 'unavailable', reason: 'rates_unavailable', nota: NOTA_TIPOS_NO_DISPONIBLES };
  }

  const driftStatus = resolveBaseDriftStatus(run, cotizacion, ratesConfig);
  if (driftStatus === 'drifted') {
    return { kind: 'unavailable', reason: 'base_drifted', nota: NOTA_BASE_DESAJUSTADA };
  }
  if (driftStatus === 'not_verifiable') {
    return { kind: 'unavailable', reason: 'base_not_verifiable', nota: NOTA_BASE_NO_COMPROBABLE };
  }

  const breakdown = computeReceiptEmployerSs(run, cotizacion, ratesConfig);
  const { employer } = ratesConfig;
  const basePeriodo = formatEuros(breakdown.basePeriodoCents);

  return {
    kind: 'figures',
    baseCotizacion: buildBaseCotizacion(breakdown.baseCotizacionCents, ratesConfig),
    filas: [
      {
        concepto: 'Contingencias comunes',
        basePeriodo,
        tipo: formatRatePercent(employer.ccPer10000),
        cuota: formatEuros(breakdown.contingenciasComunesCents),
      },
      {
        concepto: 'Contingencias profesionales (AT y EP)',
        basePeriodo,
        tipo: formatRatePercent(employer.atEpPer10000),
        cuota: formatEuros(breakdown.atEpCents),
      },
      {
        concepto: 'Desempleo',
        basePeriodo,
        tipo: formatRatePercent(employer.desempleoPer10000[cotizacion.contractType]),
        cuota: formatEuros(breakdown.desempleoCents),
      },
      {
        concepto: 'FOGASA (Fondo de Garantía Salarial)',
        basePeriodo,
        tipo: formatRatePercent(employer.fogasaPer10000),
        cuota: formatEuros(breakdown.fogasaCents),
      },
      {
        concepto: 'MEI (Mecanismo de Equidad Intergeneracional)',
        basePeriodo,
        tipo: formatRatePercent(employer.meiPer10000),
        cuota: formatEuros(breakdown.meiCents),
      },
    ],
    beneficios: [
      {
        concepto: 'Reducción por contingencias comunes',
        cuotaAfectada: formatEuros(breakdown.contingenciasComunesCents),
        tipo: formatPercent(employer.beneficios.reduccionCcPercent),
        importe: formatNegativeEuros(breakdown.reduccionCcCents),
      },
      {
        concepto: 'Bonificación por desempleo y FOGASA',
        cuotaAfectada: formatEuros(breakdown.cuotaBaseBonificacionCents),
        tipo: formatPercent(employer.beneficios.bonificacionDesempleoFogasaPercent),
        importe: formatNegativeEuros(breakdown.bonificacionDesempleoFogasaCents),
      },
    ],
    totalNominal: formatEuros(breakdown.totalNominalCents),
    totalEfectivo: formatEuros(breakdown.totalEfectivoCents),
  };
}

export function buildReceiptViewModel(input: BuildReceiptViewModelInput): ReceiptViewModel {
  const { run, employee, employer, issuedOnIso, ratesConfig, employerSignatureBase64 } = input;

  const salarioBaseCents = subtractCents(run.grossCents, run.extraCents);

  const devengos: ReceiptLineItem[] = [{ label: 'Salario base', amount: formatEuros(salarioBaseCents) }];
  if (run.extraCents > 0) {
    devengos.push({ label: 'Prorrata pagas extraordinarias', amount: formatEuros(run.extraCents) });
  }

  const deducciones: ReceiptLineItem[] = [
    { label: 'Cuota Seguridad Social (persona trabajadora)', amount: formatEuros(run.ssDeductionCents) },
  ];

  // Resolved once, threaded everywhere the base is needed (see
  // `resolveCotizacionInputs`): the desglose, the employer block and the
  // detector must agree by construction, not by coincidence.
  const cotizacion = ratesConfig === null ? null : resolveCotizacionInputs(run, employee, ratesConfig);

  const deduccionesDesglose: readonly ReceiptDeduccionDesglose[] =
    ratesConfig === null || cotizacion === null ? [] : computeDeduccionesDesglose(run, cotizacion, ratesConfig);

  const rango: string | null =
    run.periodStartDate === null || run.periodEndDate === null
      ? null
      : `del día ${dayOfMonth(run.periodStartDate)} al ${dayOfMonth(run.periodEndDate)}`;

  // Employer's default issuing place ("lugar"), when set, pre-fills the "En
  // [lugar], a [fecha]" line; null/empty preserves today's blank `………`
  // placeholder (backward-compat — spec "Receipt preserves current blank
  // behavior when lugar is absent").
  const lugar = employer.defaultLugar?.trim() ? employer.defaultLugar.trim() : null;
  const lugarYFecha =
    lugar === null
      ? `En ………, a ${formatSpanishDate(issuedOnIso)}`
      : `En ${lugar}, a ${formatSpanishDate(issuedOnIso)}`;

  return {
    empleador: {
      nombre: employer.name,
      nif: employer.nif ?? PLACEHOLDER,
      domicilio: employer.address ?? PLACEHOLDER,
      ccc: employer.ccc ?? PLACEHOLDER,
    },
    trabajador: {
      nombre: employee.name,
      nif: employee.nif ?? PLACEHOLDER,
      naf: employee.naf ?? PLACEHOLDER,
      grupoProfesional: GRUPO_PROFESIONAL,
      grupoCotizacion: employee.grupoCotizacion ?? PLACEHOLDER,
    },
    periodo: {
      descripcion: formatSpanishMonthYear(run.periodYear, run.periodMonth),
      diasTrabajados: run.daysWorked,
      diasNaturales: run.daysInMonth,
      prorrateado: run.prorated,
      rango,
    },
    devengos,
    totalDevengos: formatEuros(run.grossCents),
    deducciones,
    deduccionesDesglose,
    totalDeducciones: formatEuros(run.ssDeductionCents),
    liquidoTotal: formatEuros(run.netCents),
    empleadorCotizacion: buildEmpleadorCotizacion(run, cotizacion, ratesConfig),
    lugarYFecha,
    firmaLabel: 'Firma de la persona trabajadora',
    empleadorFirmaImagenBase64: employerSignatureBase64,
    empleadorFirmaLabel: 'Firma de la parte empleadora',
  };
}
