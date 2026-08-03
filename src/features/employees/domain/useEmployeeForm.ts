/**
 * Form-state hook backing create/edit screens: seeds values from `mode`,
 * validates via the pure `validateEmployeeForm`, and submits through the
 * matching repository method (create vs. update).
 */

import { useState } from 'react';

import { useEmployeeRepository } from '@/core';
import type { Employee } from '@/types';
import { toEuros } from '@/types/money';

import { useCurrentEmployerId } from './currentEmployer';
import { validateEmployeeForm, type EmployeeFormErrors, type EmployeeFormInput } from './validateEmployeeForm';

export type EmployeeFormMode = { kind: 'create' } | { kind: 'edit'; employee: Employee };

export interface UseEmployeeFormResult {
  readonly values: EmployeeFormInput;
  readonly errors: EmployeeFormErrors;
  readonly setField: (field: keyof EmployeeFormInput, value: string) => void;
  readonly submit: () => Promise<boolean>;
  readonly saving: boolean;
  readonly saveError: string | null;
}

function seedValues(mode: EmployeeFormMode): EmployeeFormInput {
  if (mode.kind === 'create') {
    return { name: '', nif: '', naf: '', baseGross: '', alta: '', baja: '' };
  }
  return {
    name: mode.employee.name,
    nif: mode.employee.nif ?? '',
    naf: mode.employee.naf ?? '',
    baseGross: String(toEuros(mode.employee.baseGrossCents)),
    alta: mode.employee.altaDate ?? '',
    baja: mode.employee.bajaDate ?? '',
  };
}

export function useEmployeeForm(mode: EmployeeFormMode): UseEmployeeFormResult {
  const employeeRepository = useEmployeeRepository();
  const employerId = useCurrentEmployerId();

  const [values, setValues] = useState<EmployeeFormInput>(() => seedValues(mode));
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setField = (field: keyof EmployeeFormInput, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (): Promise<boolean> => {
    const result = validateEmployeeForm(values, employerId);
    if (!result.ok) {
      setErrors(result.errors);
      return false;
    }
    setErrors({});
    setSaving(true);
    setSaveError(null);
    try {
      if (mode.kind === 'create') {
        await employeeRepository.create(result.value);
      } else {
        await employeeRepository.update(mode.employee.id, result.value);
      }
      return true;
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : String(caught));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { values, errors, setField, submit, saving, saveError };
}
