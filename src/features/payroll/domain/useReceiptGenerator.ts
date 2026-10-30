/**
 * Receipt-generation flow hook (design ADR-5): composes the employee/employer
 * fetch, resolves "today" at the call boundary (never inside the pure
 * `buildReceiptViewModel` builder -- CLAUDE.md §3/§5 purity), then runs
 * `buildReceiptViewModel` -> `buildReceiptHtml` -> `usePdfGenerator().generate`
 * against the sealed PDF engine, surfacing the resulting file `uri`.
 */

import { useState } from 'react';

import {
  readEmployerSignature,
  resolveReceiptPassword,
  useCurrentEmployerId,
  useEmployeeRepository,
  useEmployerRepository,
  usePdfGenerator,
  useSettingsRepository,
} from '@/core';
import type { PayrollRun } from '@/types';

import { buildReceiptHtml, buildReceiptViewModel } from '../receipt';
import { resolveRatesConfig } from './ssContribution';

/**
 * Fixed copy for the encrypted path. The password and any library text are
 * never shown: a failed protected generation always maps to one of these.
 */
export const RECEIPT_ENCRYPTION_UNAVAILABLE_ERROR =
  'No se puede cifrar: este empleado no tiene NIF/NIE ni contraseña propia. Añádelo en su ficha.';
export const RECEIPT_ENCRYPTION_FAILED_ERROR = 'No se pudo generar el recibo protegido. Inténtalo de nuevo.';

export interface GenerateReceiptOptions {
  /**
   * Forces a password even when the employee preference is OFF. Only `true`
   * exists on purpose: with the preference ON, a plain file is unrepresentable.
   */
  readonly encrypt?: true;
  /** Printed issue date (`YYYY-MM-DD`). Defaults to today, resolved at call time. */
  readonly issuedOnIso?: string;
}

/** A generated file plus what is needed to regenerate it later (kept in memory only). */
export interface GeneratedReceipt {
  readonly uri: string;
  readonly issuedOnIso: string;
  readonly encrypted: boolean;
}

export interface UseReceiptGeneratorResult {
  readonly generate: (run: PayrollRun, options?: GenerateReceiptOptions) => Promise<GeneratedReceipt | null>;
  readonly generating: boolean;
  readonly error: string | null;
}

export function useReceiptGenerator(): UseReceiptGeneratorResult {
  const employeeRepository = useEmployeeRepository();
  const employerRepository = useEmployerRepository();
  const settingsRepository = useSettingsRepository();
  const employerId = useCurrentEmployerId();
  const pdfGenerator = usePdfGenerator();

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (
    run: PayrollRun,
    options: GenerateReceiptOptions = {},
  ): Promise<GeneratedReceipt | null> => {
    setGenerating(true);
    setError(null);
    try {
      const [employee, employer, employerSignatureBase64] = await Promise.all([
        employeeRepository.getById(run.employeeId),
        employerRepository.getById(employerId),
        readEmployerSignature(settingsRepository),
      ]);
      if (employee === null) {
        throw new Error('No se encontró el empleado de esta nómina.');
      }
      if (employer === null) {
        throw new Error('No se encontró el empleador.');
      }

      // Fail closed BEFORE anything is printed: with encryption wanted and no
      // usable password there is no file at all, never a plain one.
      let password: string | null = null;
      if (options.encrypt === true || employee.receiptEncryptionEnabled) {
        const resolved = resolveReceiptPassword(employee);
        if (!resolved.ok) {
          throw new Error(RECEIPT_ENCRYPTION_UNAVAILABLE_ERROR);
        }
        password = resolved.password;
      }

      // "Today" is resolved HERE, at the screen-boundary call, and injected
      // into the pure builder -- never read from a clock inside it.
      const issuedOnIso = options.issuedOnIso ?? new Date().toISOString().slice(0, 10);
      // Year-not-loaded boundary (design ADR-2, mirrored from
      // usePayrollRunForm): resolved HERE, never inside the pure builder.
      // `null` degrades the receipt to the single-lump SS line, no crash.
      const ratesResult = resolveRatesConfig(run.periodYear);
      const ratesConfig = ratesResult.ok ? ratesResult.config : null;
      const viewModel = buildReceiptViewModel({
        run,
        employee,
        employer,
        issuedOnIso,
        ratesConfig,
        employerSignatureBase64,
      });
      const html = buildReceiptHtml(viewModel);

      if (password === null) {
        const { uri } = await pdfGenerator.generate(html);
        return { uri, issuedOnIso, encrypted: false };
      }
      try {
        const { uri } = await pdfGenerator.generate(html, { password });
        return { uri, issuedOnIso, encrypted: true };
      } catch {
        throw new Error(RECEIPT_ENCRYPTION_FAILED_ERROR);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generate, generating, error };
}
