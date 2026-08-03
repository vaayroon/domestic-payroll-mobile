/**
 * Payroll-owned employee picker loader.
 *
 * Decoupling note (verify-report #678 WARNING / decision #679): the payroll
 * run form used to reuse `features/employees/domain`'s `useEmployees()`
 * directly, which created a feature -> feature import forbidden by
 * CLAUDE.md §3 ("features depend on abstractions, never on each other").
 * `useEmployees()` is a thin wrapper over `useEmployeeRepository()` +
 * `useCurrentEmployerId()` (both core abstractions) plus a client-side
 * "active only" filter — no meaningful shared state to promote to `core/`,
 * so this hook re-implements that same small read+filter directly against
 * `@/core`, giving payroll its own employee-picker data without depending on
 * the employees feature's internals.
 */

import { useCallback, useEffect, useState } from 'react';

import { useCurrentEmployerId, useEmployeeRepository } from '@/core';
import type { Employee } from '@/types';

export interface UseActiveEmployeesResult {
  readonly employees: Employee[];
  readonly loading: boolean;
  readonly error: string | null;
}

export function useActiveEmployees(): UseActiveEmployeesResult {
  const employeeRepository = useEmployeeRepository();
  const employerId = useCurrentEmployerId();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await employeeRepository.list(employerId);
      setEmployees(all.filter((employee) => employee.active));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [employeeRepository, employerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { employees, loading, error };
}
