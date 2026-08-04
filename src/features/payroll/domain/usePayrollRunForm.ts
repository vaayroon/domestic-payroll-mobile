/**
 * Form-state hook backing the payroll run creation screen (design "Screen
 * architecture"): owns employee selection, the run period, the full-month SS
 * baseline input, and the pagas-extra mode; derives a live preview through
 * the pure `calculatePayrollRun` engine, and on submit guards against
 * duplicate periods (spec "Duplicate-Period Guard") before persisting.
 *
 * Uses this feature's own `useActiveEmployees()` (payroll-owned employee
 * picker data, see that file's doc comment) and the pure `parseEuroInput`
 * euro parser from `@/core` -- resolving verify-report #678's WARNING by
 * depending only on core abstractions, never on `@/features/employees/**`
 * (CLAUDE.md §3's "depend on abstractions, never on other features" rule).
 */

import { useEffect, useMemo, useState } from 'react';

import { parseEuroInput, usePayrollRunRepository } from '@/core';
import type { Employee } from '@/types';

import { calculatePayrollRun, type ExtraPayMode, type PayrollResult } from './engine';
import { useActiveEmployees } from './useActiveEmployees';

export interface UsePayrollRunFormResult {
  readonly employees: Employee[];
  readonly employeesLoading: boolean;
  readonly selectedEmployeeId: string | null;
  readonly selectEmployee: (id: string) => void;
  readonly periodYear: number;
  readonly periodMonth: number;
  readonly incrementMonth: () => void;
  readonly decrementMonth: () => void;
  readonly ssInput: string;
  readonly setSsInput: (value: string) => void;
  readonly extraPayMode: ExtraPayMode;
  readonly setExtraPayMode: (mode: ExtraPayMode) => void;
  readonly preview: PayrollResult | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly submit: () => Promise<boolean>;
}

/** UI-only default for a brand-new form; NOT read by the pure engine itself (CLAUDE.md §3/§5 purity applies to `calculatePayrollRun`, not to this screen-level default). */
function currentPeriod(): { readonly year: number; readonly month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Shifts `year`/`month` by one calendar month in either direction, rolling the year over at the Jan/Dec boundary. */
function shiftMonth(year: number, month: number, delta: 1 | -1): { readonly year: number; readonly month: number } {
  const zeroBasedMonth = month - 1 + delta;
  const normalizedMonth = ((zeroBasedMonth % 12) + 12) % 12;
  const yearOffset = Math.floor(zeroBasedMonth / 12);
  return { year: year + yearOffset, month: normalizedMonth + 1 };
}

export function usePayrollRunForm(): UsePayrollRunFormResult {
  const { employees, loading: employeesLoading } = useActiveEmployees();
  const payrollRunRepository = usePayrollRunRepository();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [periodYear, setPeriodYear] = useState<number>(() => currentPeriod().year);
  const [periodMonth, setPeriodMonth] = useState<number>(() => currentPeriod().month);
  const [ssInput, setSsInput] = useState('');
  const [extraPayMode, setExtraPayMode] = useState<ExtraPayMode>('EXCLUDE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-select the first employee once the list loads, so the form is
  // usable without an extra tap in the common single/first-employee case.
  useEffect(() => {
    const [firstEmployee] = employees;
    if (selectedEmployeeId === null && firstEmployee !== undefined) {
      setSelectedEmployeeId(firstEmployee.id);
    }
  }, [employees, selectedEmployeeId]);

  const selectedEmployee = useMemo<Employee | null>(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const preview = useMemo<PayrollResult | null>(() => {
    if (selectedEmployee === null) {
      return null;
    }
    const parsedSs = parseEuroInput(ssInput);
    if (!parsedSs.ok) {
      return null;
    }
    return calculatePayrollRun({
      baseGrossCents: selectedEmployee.baseGrossCents,
      fullMonthSsCents: parsedSs.value,
      periodYear,
      periodMonth,
      altaDate: selectedEmployee.altaDate,
      bajaDate: selectedEmployee.bajaDate,
      extraPayMode,
    });
  }, [selectedEmployee, ssInput, periodYear, periodMonth, extraPayMode]);

  const submit = async (): Promise<boolean> => {
    if (selectedEmployee === null) {
      setError('Selecciona un empleado.');
      return false;
    }

    const parsedSs = parseEuroInput(ssInput);
    if (!parsedSs.ok) {
      setError('Introduce un importe de cotización SS válido.');
      return false;
    }

    setSaving(true);
    setError(null);
    try {
      // Duplicate-period guard (spec "Duplicate-Period Guard"): the
      // pre-check is the primary defense; the DB's UNIQUE(employee,year,month)
      // index (services/db) is the backstop against a same-tick double-tap.
      const existing = await payrollRunRepository.getByPeriod(selectedEmployee.id, periodYear, periodMonth);
      if (existing !== null) {
        setError(`Ya existe una nómina para ${selectedEmployee.name} en ${periodMonth}/${periodYear}.`);
        return false;
      }

      const result = calculatePayrollRun({
        baseGrossCents: selectedEmployee.baseGrossCents,
        fullMonthSsCents: parsedSs.value,
        periodYear,
        periodMonth,
        altaDate: selectedEmployee.altaDate,
        bajaDate: selectedEmployee.bajaDate,
        extraPayMode,
      });

      await payrollRunRepository.create({
        employeeId: selectedEmployee.id,
        periodYear,
        periodMonth,
        grossCents: result.grossCents,
        ssDeductionCents: result.ssDeductionCents,
        netCents: result.netCents,
        prorated: result.prorated,
        extraCents: result.extraCents,
        daysWorked: result.daysWorked,
        daysInMonth: result.daysInMonth,
      });
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    employees,
    employeesLoading,
    selectedEmployeeId,
    selectEmployee: setSelectedEmployeeId,
    periodYear,
    periodMonth,
    incrementMonth: () => {
      const next = shiftMonth(periodYear, periodMonth, 1);
      setPeriodYear(next.year);
      setPeriodMonth(next.month);
    },
    decrementMonth: () => {
      const next = shiftMonth(periodYear, periodMonth, -1);
      setPeriodYear(next.year);
      setPeriodMonth(next.month);
    },
    ssInput,
    setSsInput,
    extraPayMode,
    setExtraPayMode,
    preview,
    saving,
    error,
    submit,
  };
}
