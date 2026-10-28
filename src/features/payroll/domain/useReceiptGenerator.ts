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
  useCurrentEmployerId,
  useEmployeeRepository,
  useEmployerRepository,
  usePdfGenerator,
  useSettingsRepository,
} from '@/core';
import type { PayrollRun } from '@/types';

import { buildReceiptHtml, buildReceiptViewModel } from '../receipt';
import { resolveRatesConfig } from './ssContribution';

export interface UseReceiptGeneratorResult {
  readonly generate: (run: PayrollRun) => Promise<{ readonly uri: string } | null>;
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

  const generate = async (run: PayrollRun): Promise<{ readonly uri: string } | null> => {
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

      // "Today" is resolved HERE, at the screen-boundary call, and injected
      // into the pure builder -- never read from a clock inside it.
      const issuedOnIso = new Date().toISOString().slice(0, 10);
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

      const { uri } = await pdfGenerator.generate(html);
      return { uri };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generate, generating, error };
}
