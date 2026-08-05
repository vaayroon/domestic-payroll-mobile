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
import { multiplyByRatio, subtractCents } from '@/types/money';

import {
  resolveBaseCotizacion,
  resolveRetribucionCents,
  SS_DIVISOR,
  type RatesConfig,
} from '../domain/ssContribution';
import type { ReceiptDeduccionDesglose, ReceiptLineItem, ReceiptViewModel } from './ReceiptViewModel';

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
}

/** Formats an integer parts-per-10000 rate as a Spanish percentage string, e.g. `470` -> `"4,70 %"`. */
function formatRatePercent(per10000: number): string {
  return `${(per10000 / 100).toFixed(2).replace('.', ',')} %`;
}

/** Extracts the 1-based day-of-month from an ISO `'YYYY-MM-DD'` string. */
function dayOfMonth(iso: string): number {
  return Number(iso.split('-')[2]);
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

  // Mirrors the engine's SS days-worked normalization (engine.ts:
  // `calculatePayrollRun`) -- a full month normalizes to SS_DIVISOR itself,
  // never the real calendar `daysInMonth`.
  const ssDaysWorked = run.prorated ? run.daysWorked : SS_DIVISOR;

  const desempleoPer10000 = ratesConfig.worker.desempleoPer10000[employee.contractType];
  const meiPer10000 = ratesConfig.worker.meiPer10000;

  const desempleoCuotaCents = multiplyByRatio(baseCotizacionCents, desempleoPer10000 * ssDaysWorked, 10000 * SS_DIVISOR);
  const meiCuotaCents = multiplyByRatio(baseCotizacionCents, meiPer10000 * ssDaysWorked, 10000 * SS_DIVISOR);
  const contingenciasComunesCuotaCents = subtractCents(subtractCents(run.ssDeductionCents, desempleoCuotaCents), meiCuotaCents);

  const baseDisplay = formatEuros(baseCotizacionCents);

  return [
    {
      concepto: 'Contingencias comunes',
      base: baseDisplay,
      tipo: formatRatePercent(ratesConfig.worker.ccPer10000),
      cuota: formatEuros(contingenciasComunesCuotaCents),
    },
    {
      concepto: 'Desempleo',
      base: baseDisplay,
      tipo: formatRatePercent(desempleoPer10000),
      cuota: formatEuros(desempleoCuotaCents),
    },
    {
      concepto: 'MEI (Mecanismo de Equidad Intergeneracional)',
      base: baseDisplay,
      tipo: formatRatePercent(meiPer10000),
      cuota: formatEuros(meiCuotaCents),
    },
  ];
}

export function buildReceiptViewModel(input: BuildReceiptViewModelInput): ReceiptViewModel {
  const { run, employee, employer, issuedOnIso, ratesConfig } = input;

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
    lugarYFecha: `En ………, a ${formatSpanishDate(issuedOnIso)}`,
    firmaLabel: 'Firma de la persona trabajadora',
  };
}
