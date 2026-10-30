/**
 * Pure builder for the Spanish subject/body of the receipt-dispatch email
 * (design ADR-7). NO I/O, NO clock read inside -- derives only from
 * `run.periodYear`/`run.periodMonth` + `employee.name`. Reuses the existing
 * `formatSpanishMonthYear` helper (do NOT re-derive month names). No `Cents`
 * field is ever formatted or leaked here -- the amounts belong to the PDF,
 * not the email copy.
 */

import type { ReceiptPasswordSource } from '@/core';
import type { Employee, PayrollRun } from '@/types';

import { formatSpanishMonthYear } from '../formatSpanishDate';

export interface ReceiptMailContent {
  readonly subject: string;
  readonly body: string;
}

/**
 * The password sentence of a protected receipt. The override value itself is
 * NEVER written: for an own password the employee is told it was provided
 * separately. The NIF wording is used only for a document source.
 */
const PASSWORD_SENTENCE: Record<ReceiptPasswordSource, string> = {
  document: 'La contraseña es su NIF/NIE, en mayúsculas y sin espacios ni guiones.',
  override: 'La contraseña es la que le hemos facilitado.',
};

const PROTECTED_FILE_SENTENCE = 'El archivo está protegido con contraseña para evitar aperturas accidentales.';

/**
 * `passwordSource` is `null` for a plain file (the body is unchanged), or the
 * source of the password that protects the attached file.
 */
export function buildReceiptMailContent(
  run: PayrollRun,
  employee: Employee,
  passwordSource: ReceiptPasswordSource | null = null,
): ReceiptMailContent {
  const periodo = formatSpanishMonthYear(run.periodYear, run.periodMonth);
  const protection =
    passwordSource === null ? '' : `${PROTECTED_FILE_SENTENCE} ${PASSWORD_SENTENCE[passwordSource]}\n\n`;

  return {
    subject: `Recibo de salarios — ${periodo}`,
    body: `Estimado/a ${employee.name}:\n\nAdjunto el recibo individual de salarios correspondiente a ${periodo}.\n\n${protection}Un saludo.`,
  };
}
