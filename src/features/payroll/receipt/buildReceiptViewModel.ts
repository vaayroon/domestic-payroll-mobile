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
import type { Employee, Employer, PayrollRun } from '@/types';
import { type Cents, multiplyByRatio, subtractCents } from '@/types/money';

import {
  computeEmployerSs,
  computeWorkerSs,
  resolveBaseCotizacion,
  resolveRetribucionCents,
  SS_DIVISOR,
  type RatesConfig,
} from '../domain/ssContribution';
import type {
  ReceiptDeduccionDesglose,
  ReceiptEmpleadorCotizacion,
  ReceiptLineItem,
  ReceiptViewModel,
} from './ReceiptViewModel';

/** Hardcoded category label -- there is no stored `Employee` field for it (design ADR-3). */
const GRUPO_COTIZACION = 'Empleado/a de Hogar';

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
 * Per-contingency breakdown of the worker's SS cuota (contingencias comunes /
 * desempleo / MEI), reconciled to the persisted `ssDeductionCents` via
 * residual-on-largest-line (design "Cuota reconciliation"): the two smaller
 * components (desempleo, MEI) are computed with the SAME proration ratio the
 * engine used, then contingencias comunes absorbs whatever residual remains
 * so the column always foots exactly to the authoritative persisted total --
 * never independently re-rounded into a ±1-2 cent drift.
 */
function computeDeduccionesDesglose(
  run: PayrollRun,
  employee: Employee,
  ratesConfig: RatesConfig,
): readonly ReceiptDeduccionDesglose[] {
  const retribucionCents = resolveRetribucionCents(employee.baseGrossCents);
  const baseCotizacionCents = resolveBaseCotizacion(ratesConfig.tramos, ratesConfig.topeMaxBaseCents, retribucionCents);

  const ssDaysWorked = resolveSsDaysWorked(run);

  const desempleoPer10000 = ratesConfig.worker.desempleoPer10000[employee.contractType];
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

type BaseDriftStatus = 'verified' | 'drifted' | 'not_verifiable';

/**
 * Reprint base-drift detector. The receipt recomputes its figures from the
 * CURRENT `employee.baseGrossCents`, not from anything stored on the run, so
 * an edit to the employee after the run would silently reprint different
 * numbers. This recomputes the worker cuota from the current base and compares
 * it to the persisted `run.ssDeductionCents`: a mismatch proves the base de
 * cotización moved since the run.
 *
 * It is sound, not lucky: tramos 1-7 map a RANGE of retribución to a FIXED
 * base, so an edit inside one tramo changes nothing on the receipt. The
 * apparent false negative is a true negative. A cross-tramo edit, or any edit
 * in the open-ended 8º tramo, moves the cuota and is caught.
 *
 * Rules, evaluated in this order:
 *   1. No `RatesConfig`: nothing to recompute with.
 *   2. `daysInMonth === 0`: a provable legacy run. The engine never emits 0
 *      (always 28-31), so this is a pre-migration-0002 row backfilled to 0,
 *      whose persisted cuota was typed by hand. The comparison would be
 *      meaningless, not merely wrong.
 *   3. Persisted cuota 0 while the recompute is positive: every tramo has a
 *      positive base, so a zero persisted cuota is an absent input, not a
 *      moved base.
 *   4. Equal: verified. 5. Otherwise: drifted.
 *
 * Known and accepted, not suppressed:
 *   - A correction to `SS_RATES_BY_YEAR` for an already-run year also trips
 *     this. That is correct: the printed figures no longer match what was filed.
 *   - A residual band of manual-era runs (typed cuota, but real day data)
 *     falls to `drifted`. Their worker cuota above the employer block came from
 *     a different source than the block, so "does not match" is still true.
 *
 * Detection is not repair: the worker rows still drift silently (contingencias
 * comunes absorbs the residual). Only a persisted anchor on `PayrollRun`
 * (separate slice `payroll-run-base-anchor`) fixes that. What this buys is that
 * the NEW employer block never prints confident wrong numbers.
 */
function resolveBaseDriftStatus(run: PayrollRun, employee: Employee, ratesConfig: RatesConfig | null): BaseDriftStatus {
  if (ratesConfig === null) {
    return 'not_verifiable';
  }
  if (run.daysInMonth === 0) {
    return 'not_verifiable';
  }

  const recomputedWorkerSsCents = computeWorkerSs(
    ratesConfig,
    employee.baseGrossCents,
    resolveSsDaysWorked(run),
    employee.contractType,
  ).proratedWorkerSsCents;

  if (run.ssDeductionCents === 0 && recomputedWorkerSsCents > 0) {
    return 'not_verifiable';
  }
  return recomputedWorkerSsCents === run.ssDeductionCents ? 'verified' : 'drifted';
}

const NOTA_TIPOS_NO_DISPONIBLES =
  'No se ha podido determinar la cotización a cargo de la parte empleadora porque no están disponibles los tipos de cotización del año de este período. Este recibo refleja únicamente los devengos y las deducciones de la persona trabajadora.';

// Both notes below replace the rows and totals, they do not accompany them: a
// run whose base cannot be trusted shows no employer figure at all.
const NOTA_BASE_DESAJUSTADA =
  'No se muestran las cifras de cotización a cargo de la parte empleadora porque la base de cotización actual no coincide con la utilizada en la liquidación de este período. Consulte la liquidación original.';

const NOTA_BASE_NO_COMPROBABLE =
  'Este período no permite comprobar la base de cotización utilizada en su día, por lo que no se muestran las cifras de cotización a cargo de la parte empleadora.';

/**
 * Employer "determinación de bases y cuotas" block: maps the flat
 * `computeEmployerSs` record to ordered, labelled rows (the domain knows no
 * labels or order). Only a verified run gets figures; every other state yields
 * a note and no figures.
 */
function buildEmpleadorCotizacion(
  run: PayrollRun,
  employee: Employee,
  ratesConfig: RatesConfig | null,
): ReceiptEmpleadorCotizacion {
  if (ratesConfig === null) {
    return { kind: 'unavailable', reason: 'rates_unavailable', nota: NOTA_TIPOS_NO_DISPONIBLES };
  }

  const driftStatus = resolveBaseDriftStatus(run, employee, ratesConfig);
  if (driftStatus === 'drifted') {
    return { kind: 'unavailable', reason: 'base_drifted', nota: NOTA_BASE_DESAJUSTADA };
  }
  if (driftStatus === 'not_verifiable') {
    return { kind: 'unavailable', reason: 'base_not_verifiable', nota: NOTA_BASE_NO_COMPROBABLE };
  }

  const breakdown = computeEmployerSs(ratesConfig, employee.baseGrossCents, resolveSsDaysWorked(run), employee.contractType);
  const { employer } = ratesConfig;
  const basePeriodo = formatEuros(breakdown.basePeriodoCents);

  return {
    kind: 'figures',
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
        tipo: formatRatePercent(employer.desempleoPer10000[employee.contractType]),
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

  const deduccionesDesglose: readonly ReceiptDeduccionDesglose[] =
    ratesConfig === null ? [] : computeDeduccionesDesglose(run, employee, ratesConfig);

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
      grupoCotizacion: GRUPO_COTIZACION,
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
    empleadorCotizacion: buildEmpleadorCotizacion(run, employee, ratesConfig),
    lugarYFecha,
    firmaLabel: 'Firma de la persona trabajadora',
    empleadorFirmaImagenBase64: employerSignatureBase64,
    empleadorFirmaLabel: 'Firma de la parte empleadora',
  };
}
