/**
 * Receipt-generation flow hook (design ADR-5): composes the employee/employer
 * fetch, resolves "today" at the call boundary (never inside the pure
 * `buildReceiptViewModel` builder -- CLAUDE.md §3/§5 purity), then runs
 * `buildReceiptViewModel` -> `buildReceiptHtml` -> `usePdfGenerator().generate`
 * against the sealed PDF engine, surfacing the resulting file `uri`.
 */

import { useState } from 'react';

import {
  buildReceiptFileName,
  readEmployerSignature,
  readReceiptFileNameFormat,
  resolveReceiptFileNameFormat,
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
 * Why a generation failed. The screen maps the code with `t`. For the encrypted
 * path the password and any library text are never exposed: a failed protected
 * generation always maps to one of the fixed codes. `failed` carries the
 * technical message of any other failure, untranslated.
 */
export type ReceiptGenerationError =
  | {
      readonly code:
        | 'employee_not_found'
        | 'employer_not_found'
        | 'encryption_unavailable'
        | 'encryption_failed';
    }
  | { readonly code: 'failed'; readonly detail: string };

type FixedErrorCode = Exclude<ReceiptGenerationError['code'], 'failed'>;

/** Internal carrier so the flow can bail out with a fixed code from any depth of the try block. */
class ReceiptGenerationFailure extends Error {
  constructor(readonly code: FixedErrorCode) {
    super(code);
  }
}

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
  /**
   * Replaces a plain file with an encrypted one for the same run, keeping the
   * ORIGINAL issue date. The previous file is discarded only after the new one
   * exists; on any failure it is left untouched and `null` is returned.
   */
  readonly regenerateProtected: (
    previous: { readonly run: PayrollRun } & GeneratedReceipt,
  ) => Promise<GeneratedReceipt | null>;
  readonly generating: boolean;
  readonly error: ReceiptGenerationError | null;
}

export function useReceiptGenerator(): UseReceiptGeneratorResult {
  const employeeRepository = useEmployeeRepository();
  const employerRepository = useEmployerRepository();
  const settingsRepository = useSettingsRepository();
  const employerId = useCurrentEmployerId();
  const pdfGenerator = usePdfGenerator();

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<ReceiptGenerationError | null>(null);

  const generate = async (
    run: PayrollRun,
    options: GenerateReceiptOptions = {},
  ): Promise<GeneratedReceipt | null> => {
    setGenerating(true);
    setError(null);
    try {
      const [employee, employer, employerSignatureBase64, globalFileNameFormat] = await Promise.all([
        employeeRepository.getById(run.employeeId),
        employerRepository.getById(employerId),
        readEmployerSignature(settingsRepository),
        readReceiptFileNameFormat(settingsRepository),
      ]);
      if (employee === null) {
        throw new ReceiptGenerationFailure('employee_not_found');
      }
      if (employer === null) {
        throw new ReceiptGenerationFailure('employer_not_found');
      }

      // Fail closed BEFORE anything is printed: with encryption wanted and no
      // usable password there is no file at all, never a plain one.
      let password: string | null = null;
      if (options.encrypt === true || employee.receiptEncryptionEnabled) {
        const resolved = resolveReceiptPassword(employee);
        if (!resolved.ok) {
          throw new ReceiptGenerationFailure('encryption_unavailable');
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

      // The employee's own choice wins over the general setting ('auto' forces
      // the random name, null inherits). The name comes from the run's own
      // period, never from the issue date, and is built here (not in the HTML
      // pipeline) so the adapter stays domain-free. No format, or a period that
      // cannot be named, keeps the random expo-print name: a name is never
      // worth failing a receipt.
      const fileNameFormat = resolveReceiptFileNameFormat(employee.receiptFileNameFormat, globalFileNameFormat);
      const fileName =
        fileNameFormat === null
          ? null
          : buildReceiptFileName(fileNameFormat, employee.name, run.periodYear, run.periodMonth);
      const nameOption = fileName === null ? {} : { fileName };

      if (password === null) {
        const { uri } = await pdfGenerator.generate(html, nameOption);
        return { uri, issuedOnIso, encrypted: false };
      }
      try {
        const { uri } = await pdfGenerator.generate(html, { ...nameOption, password });
        return { uri, issuedOnIso, encrypted: true };
      } catch {
        throw new ReceiptGenerationFailure('encryption_failed');
      }
    } catch (caught) {
      setError(
        caught instanceof ReceiptGenerationFailure
          ? { code: caught.code }
          : { code: 'failed', detail: caught instanceof Error ? caught.message : String(caught) },
      );
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const regenerateProtected = async (
    previous: { readonly run: PayrollRun } & GeneratedReceipt,
  ): Promise<GeneratedReceipt | null> => {
    const regenerated = await generate(previous.run, { encrypt: true, issuedOnIso: previous.issuedOnIso });
    if (regenerated === null) {
      return null;
    }
    // Best effort and never the file we just produced: a failed cleanup must
    // not turn a successful regeneration into an error.
    if (regenerated.uri !== previous.uri) {
      await pdfGenerator.discard(previous.uri).catch(() => undefined);
    }
    return regenerated;
  };

  return { generate, regenerateProtected, generating, error };
}
