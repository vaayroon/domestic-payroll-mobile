/**
 * Re-derives the open password of an encrypted receipt for the viewer (design
 * D6, spec R10). The route carries only the non-secret `encrypted=1` flag, so
 * no secret ever enters navigation state: the password is recomputed from the
 * employee through the same pure rule used at generation time.
 *
 * If the employee's own password was edited after the file was generated the
 * derived value no longer matches the file; the viewer then fails and the
 * remedy is to regenerate (documented drift).
 *
 * The password is never logged and no error text is exposed: every failure
 * collapses to `unavailable`.
 */

import { useEffect, useState } from 'react';

import { resolveReceiptPassword, useEmployeeRepository } from '@/core';

export type ReceiptPasswordState =
  | { readonly status: 'not_needed' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly password: string }
  | { readonly status: 'unavailable' };

const NOT_NEEDED: ReceiptPasswordState = { status: 'not_needed' };
const LOADING: ReceiptPasswordState = { status: 'loading' };
const UNAVAILABLE: ReceiptPasswordState = { status: 'unavailable' };

export function useReceiptPassword(employeeId: string | null, encrypted: boolean): ReceiptPasswordState {
  const employeeRepository = useEmployeeRepository();
  const [state, setState] = useState<ReceiptPasswordState>(encrypted ? LOADING : NOT_NEEDED);

  useEffect(() => {
    if (!encrypted) {
      setState(NOT_NEEDED);
      return;
    }
    if (employeeId === null) {
      setState(UNAVAILABLE);
      return;
    }

    let cancelled = false;
    setState(LOADING);
    employeeRepository
      .getById(employeeId)
      .then((employee) => {
        if (cancelled) {
          return;
        }
        const resolved = employee === null ? null : resolveReceiptPassword(employee);
        setState(resolved !== null && resolved.ok ? { status: 'ready', password: resolved.password } : UNAVAILABLE);
      })
      .catch(() => {
        if (!cancelled) {
          setState(UNAVAILABLE);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [employeeRepository, employeeId, encrypted]);

  return state;
}
