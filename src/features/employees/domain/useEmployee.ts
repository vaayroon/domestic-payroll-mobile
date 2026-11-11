/**
 * Single-employee loader hook, used to prefill the edit screen.
 */

import { useEffect, useState } from 'react';

import { useEmployeeRepository } from '@/core';
import type { Employee } from '@/types';

/** Load failure of the single-employee loader; screens map `code` with `t`. `read_failed` carries the repository's technical message untranslated. */
export type EmployeeLoadError = { readonly code: 'read_failed'; readonly detail: string };

export interface UseEmployeeResult {
  readonly employee: Employee | null;
  readonly loading: boolean;
  readonly error: EmployeeLoadError | null;
}

export function useEmployee(id: string): UseEmployeeResult {
  const employeeRepository = useEmployeeRepository();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<EmployeeLoadError | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await employeeRepository.getById(id);
        if (cancelled) {
          return;
        }
        setEmployee(result);
        setError(null);
      } catch (caught) {
        if (cancelled) {
          return;
        }
        setError({
          code: 'read_failed',
          detail: caught instanceof Error ? caught.message : String(caught),
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [employeeRepository, id]);

  return { employee, loading, error };
}
