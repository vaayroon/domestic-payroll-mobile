/**
 * Resolves a persisted payroll run for the receipt viewer (design ADR-7).
 * The viewer route only receives `employeeId` + `runId`, so the run is found
 * through the existing `PayrollRunRepository.listByEmployee` and matched by
 * id -- no new repository method (the interface does not grow).
 *
 * Both ids are nullable because the hook is called unconditionally at the
 * container top-level while route params may fail validation. A null id or a
 * repository rejection resolves to `missing`; no error text is ever exposed.
 */

import { useEffect, useState } from 'react';

import { usePayrollRunRepository } from '@/core';
import type { PayrollRun } from '@/types';

export type ReceiptRunStatus = 'loading' | 'ready' | 'missing';

export interface UseReceiptRunResult {
  readonly status: ReceiptRunStatus;
  readonly run: PayrollRun | null;
}

const LOADING: UseReceiptRunResult = { status: 'loading', run: null };
const MISSING: UseReceiptRunResult = { status: 'missing', run: null };

export function useReceiptRun(
  employeeId: string | null,
  runId: string | null,
): UseReceiptRunResult {
  const payrollRunRepository = usePayrollRunRepository();
  const [result, setResult] = useState<UseReceiptRunResult>(LOADING);

  useEffect(() => {
    if (employeeId === null || runId === null) {
      setResult(MISSING);
      return;
    }

    let cancelled = false;
    setResult(LOADING);
    payrollRunRepository
      .listByEmployee(employeeId)
      .then((runs) => {
        const run = runs.find((candidate) => candidate.id === runId) ?? null;
        if (!cancelled) {
          setResult(run === null ? MISSING : { status: 'ready', run });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult(MISSING);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [payrollRunRepository, employeeId, runId]);

  return result;
}
