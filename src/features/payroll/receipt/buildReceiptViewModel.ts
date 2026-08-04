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
import { subtractCents } from '@/types/money';

import type { ReceiptLineItem, ReceiptViewModel } from './ReceiptViewModel';

/** Hardcoded category label -- there is no stored `Employee` field for it (design ADR-3). */
const GRUPO_COTIZACION = 'Empleado/a de Hogar';

const PLACEHOLDER = '—';

export interface BuildReceiptViewModelInput {
  readonly run: PayrollRun;
  readonly employee: Employee;
  readonly employer: Employer;
  /** ISO `'YYYY-MM-DD'` issue date, injected -- never read from a system clock here. */
  readonly issuedOnIso: string;
}

export function buildReceiptViewModel(input: BuildReceiptViewModelInput): ReceiptViewModel {
  const { run, employee, employer, issuedOnIso } = input;

  const salarioBaseCents = subtractCents(run.grossCents, run.extraCents);

  const devengos: ReceiptLineItem[] = [{ label: 'Salario base', amount: formatEuros(salarioBaseCents) }];
  if (run.extraCents > 0) {
    devengos.push({ label: 'Prorrata pagas extraordinarias', amount: formatEuros(run.extraCents) });
  }

  const deducciones: ReceiptLineItem[] = [
    { label: 'Cuota Seguridad Social (persona trabajadora)', amount: formatEuros(run.ssDeductionCents) },
  ];

  return {
    empleador: {
      nombre: employer.name,
      nif: employer.nif ?? PLACEHOLDER,
      domicilio: employer.address ?? PLACEHOLDER,
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
    },
    devengos,
    totalDevengos: formatEuros(run.grossCents),
    deducciones,
    totalDeducciones: formatEuros(run.ssDeductionCents),
    liquidoTotal: formatEuros(run.netCents),
    lugarYFecha: `En ………, a ${formatSpanishDate(issuedOnIso)}`,
    firmaLabel: 'Firma de la persona trabajadora',
  };
}
