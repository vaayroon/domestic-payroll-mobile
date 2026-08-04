/**
 * Pure builder for the Spanish subject/body of the receipt-dispatch email
 * (design ADR-7). NO I/O, NO clock read inside -- derives only from
 * `run.periodYear`/`run.periodMonth` + `employee.name`. Reuses the existing
 * `formatSpanishMonthYear` helper (do NOT re-derive month names). No `Cents`
 * field is ever formatted or leaked here -- the amounts belong to the PDF,
 * not the email copy.
 */

import { formatSpanishMonthYear } from '../formatSpanishDate';
import type { Employee, PayrollRun } from '@/types';

export interface ReceiptMailContent {
  readonly subject: string;
  readonly body: string;
}

export function buildReceiptMailContent(run: PayrollRun, employee: Employee): ReceiptMailContent {
  const periodo = formatSpanishMonthYear(run.periodYear, run.periodMonth);

  return {
    subject: `Recibo de salarios — ${periodo}`,
    body: `Estimado/a ${employee.name}:\n\nAdjunto el recibo individual de salarios correspondiente a ${periodo}.\n\nUn saludo.`,
  };
}
