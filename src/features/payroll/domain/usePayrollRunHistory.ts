/**
 * Run-history loader hook (design ADR-5). Loads an employee's persisted runs
 * via `PayrollRunRepository.listByEmployee` and sorts them MOST-RECENT-FIRST
 * in the hook itself (periodYear desc, then periodMonth desc, `createdAt`
 * desc as the final tiebreak) -- sorting is a presentation concern, so the
 * repository interface/fake stay untouched (design ADR-5 rationale).
 */

import { useCallback, useEffect, useState } from 'react';

import { usePayrollRunRepository } from '@/core';
import type { PayrollRun } from '@/types';

/** Load failure of the run history; screens map `code` with `t`. `read_failed` carries the repository's technical message untranslated. */
export type PayrollRunHistoryError = { readonly code: 'read_failed'; readonly detail: string };

export interface UsePayrollRunHistoryResult {
  readonly runs: PayrollRun[];
  readonly loading: boolean;
  readonly error: PayrollRunHistoryError | null;
  readonly refresh: () => Promise<void>;
}

/** Most-recent-first: periodYear desc, periodMonth desc, createdAt desc tiebreak. */
function sortMostRecentFirst(runs: PayrollRun[]): PayrollRun[] {
  return [...runs].sort((a, b) => {
    if (a.periodYear !== b.periodYear) {
      return b.periodYear - a.periodYear;
    }
    if (a.periodMonth !== b.periodMonth) {
      return b.periodMonth - a.periodMonth;
    }
    return b.createdAt - a.createdAt;
  });
}

export function usePayrollRunHistory(employeeId: string): UsePayrollRunHistoryResult {
  const payrollRunRepository = usePayrollRunRepository();

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PayrollRunHistoryError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await payrollRunRepository.listByEmployee(employeeId);
      setRuns(sortMostRecentFirst(all));
      setError(null);
    } catch (caught) {
      setError({
        code: 'read_failed',
        detail: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      setLoading(false);
    }
  }, [payrollRunRepository, employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { runs, loading, error, refresh };
}
