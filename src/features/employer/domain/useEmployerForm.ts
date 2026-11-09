/**
 * Form-state hook for the employer-settings screen: EDIT-ONLY (design
 * ADR-5) — the bootstrap `Employer` row always exists
 * (`CurrentEmployerProvider`), so there is no create mode. Loads the current
 * employer by id in an effect (mirrors `employees/[id]/edit`'s load-by-id,
 * since `CurrentEmployerProvider` only exposes the id — `useCurrentEmployerId`),
 * seeds the form, then validates via the pure `validateEmployerForm` and
 * submits through `EmployerRepository.update()`.
 */

import { useEffect, useState } from 'react';

import { useCurrentEmployerId, useEmployerRepository } from '@/core';

import { validateEmployerForm, type EmployerFormErrors, type EmployerFormInput } from './validateEmployerForm';

/**
 * Why the employer profile could not be shown. `not_found` is a code the screen
 * maps with `t`; `read_failed` carries the repository's technical message.
 */
export type EmployerLoadError =
  | { readonly code: 'not_found' }
  | { readonly code: 'read_failed'; readonly detail: string };

/** Save failure; screens map `code` with `t`. `save_failed` carries the repository's technical message. */
export type EmployerFormSaveError = { readonly code: 'save_failed'; readonly detail: string };

export interface UseEmployerFormResult {
  readonly loading: boolean;
  readonly loadError: EmployerLoadError | null;
  readonly values: EmployerFormInput;
  readonly errors: EmployerFormErrors;
  readonly setField: <K extends keyof EmployerFormInput>(field: K, value: EmployerFormInput[K]) => void;
  readonly submit: () => Promise<boolean>;
  readonly saving: boolean;
  readonly saveError: EmployerFormSaveError | null;
}

const EMPTY_VALUES: EmployerFormInput = { name: '', nif: '', address: '', ccc: '', defaultLugar: '' };

export function useEmployerForm(): UseEmployerFormResult {
  const employerRepository = useEmployerRepository();
  const employerId = useCurrentEmployerId();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<EmployerLoadError | null>(null);
  const [values, setValues] = useState<EmployerFormInput>(EMPTY_VALUES);
  const [errors, setErrors] = useState<EmployerFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<EmployerFormSaveError | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const employer = await employerRepository.getById(employerId);
        if (cancelled) {
          return;
        }
        if (employer === null) {
          // Defensive only: `CurrentEmployerProvider` guarantees the
          // bootstrap row exists before this hook can render.
          setLoadError({ code: 'not_found' });
        } else {
          setValues({
            name: employer.name,
            nif: employer.nif ?? '',
            address: employer.address ?? '',
            ccc: employer.ccc ?? '',
            defaultLugar: employer.defaultLugar ?? '',
          });
          setLoadError(null);
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }
        setLoadError({ code: 'read_failed', detail: caught instanceof Error ? caught.message : String(caught) });
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
  }, [employerRepository, employerId]);

  const setField = <K extends keyof EmployerFormInput>(field: K, value: EmployerFormInput[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (): Promise<boolean> => {
    const result = validateEmployerForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return false;
    }
    setErrors({});
    setSaving(true);
    setSaveError(null);
    try {
      await employerRepository.update(employerId, result.value);
      return true;
    } catch (caught) {
      setSaveError({ code: 'save_failed', detail: caught instanceof Error ? caught.message : String(caught) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { loading, loadError, values, errors, setField, submit, saving, saveError };
}
