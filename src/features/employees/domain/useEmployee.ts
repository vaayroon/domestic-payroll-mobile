/**
 * Single-employee loader hook, used to prefill the edit screen.
 */

import { useEffect, useState } from 'react';

import { useEmployeeRepository } from '@/core';
import type { Employee } from '@/types';

export interface UseEmployeeResult {
  readonly employee: Employee | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export function useEmployee(id: string): UseEmployeeResult {
  const employeeRepository = useEmployeeRepository();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(caught instanceof Error ? caught.message : String(caught));
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
