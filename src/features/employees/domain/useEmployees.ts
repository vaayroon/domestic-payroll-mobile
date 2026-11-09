/**
 * Container hook backing the employee list screen (design ADR-1): resolves
 * "active" client-side via `all.filter((e) => e.active)` — the
 * `EmployeeRepository.list(employerId)` interface itself stays unfiltered.
 * See ADR-1 in `sdd/employees/design` for the full rationale.
 */

import { useCallback, useEffect, useState } from 'react';

import { useCurrentEmployerId, useEmployeeRepository } from '@/core';
import type { Employee } from '@/types';

/** Load failure of the employee list; screens map `code` with `t`. `read_failed` carries the repository's technical message untranslated. */
export type EmployeeListError = { readonly code: 'read_failed'; readonly detail: string };

export interface UseEmployeesResult {
  readonly employees: Employee[];
  readonly loading: boolean;
  readonly error: EmployeeListError | null;
  readonly refresh: () => Promise<void>;
  readonly deactivate: (id: string) => Promise<void>;
}

export function useEmployees(): UseEmployeesResult {
  const employeeRepository = useEmployeeRepository();
  const employerId = useCurrentEmployerId();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<EmployeeListError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await employeeRepository.list(employerId);
      setEmployees(all.filter((employee) => employee.active));
      setError(null);
    } catch (caught) {
      setError({
        code: 'read_failed',
        detail: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      setLoading(false);
    }
  }, [employeeRepository, employerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const deactivate = useCallback(
    async (id: string) => {
      await employeeRepository.update(id, { active: false });
      await refresh();
    },
    [employeeRepository, refresh],
  );

  return { employees, loading, error, refresh, deactivate };
}
