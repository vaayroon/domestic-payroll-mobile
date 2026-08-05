/**
 * Form-state hook backing the payroll run creation screen (design "Screen
 * architecture"): owns employee selection, the run period, and the
 * pagas-extra mode; derives a live, READ-ONLY SS preview through the pure
 * `calculatePayrollRun` engine (SS is COMPUTED from the employee's base
 * gross + contract type, never manually entered -- spec "PayrollRun consumes
 * computed SS, not manual entry"), and on submit guards against duplicate
 * periods (spec "Duplicate-Period Guard") before persisting.
 *
 * Year-not-loaded boundary (design ADR-2): `resolveRatesConfig` is called
 * HERE, at the form-hook boundary -- never inside the pure engine. When the
 * run period's year has no loaded `RatesConfig`, `preview` stays `null` and
 * `ratesWarning` carries the Spanish message; `submit()` refuses to compute
 * or persist anything for that period.
 *
 * Uses this feature's own `useActiveEmployees()` (payroll-owned employee
 * picker data, see that file's doc comment) -- resolving verify-report
 * #678's WARNING by depending only on core abstractions, never on
 * `@/features/employees/**` (CLAUDE.md §3's "depend on abstractions, never
 * on other features" rule).
 */

import { useEffect, useMemo, useState } from 'react';

import { usePayrollRunRepository } from '@/core';
import type { Employee } from '@/types';

import { calculatePayrollRun, resolveEffectivePeriod, type ExtraPayMode, type PayrollResult } from './engine';
import { resolveRatesConfig } from './ssContribution';
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
  readonly extraPayMode: ExtraPayMode;
  readonly setExtraPayMode: (mode: ExtraPayMode) => void;
  /**
   * Editable per-run period date range (ISO `'YYYY-MM-DD'`), prefilled from
   * the selected employee's `altaDate`/`bajaDate` clipped to the selected
   * month (spec "Range prefill from alta/baja clipped to month", Scenarios
   * 3/4/5). `null` when there is no overlap to prefill or no employee
   * selected yet -- the user may still fill both fields in manually.
   */
  readonly periodStartDate: string | null;
  readonly setPeriodStartDate: (date: string | null) => void;
  readonly periodEndDate: string | null;
  readonly setPeriodEndDate: (date: string | null) => void;
  /** Spanish validation error when `periodStartDate > periodEndDate` (spec Scenario 9); `null` when the range is valid or incomplete. */
  readonly rangeError: string | null;
  readonly preview: PayrollResult | null;
  /** Spanish warning to show instead of a preview when the period year's SS rates are not loaded. */
  readonly ratesWarning: string | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly submit: () => Promise<boolean>;
}

const RATES_NOT_LOADED_MESSAGE =
  'No se han cargado las tarifas de cotización para este año. No se puede calcular la nómina.';

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

/** Formats a 1-based calendar day within `year`-`month` as an ISO `'YYYY-MM-DD'` string. UI-formatting only, not engine logic. */
function isoForDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const RANGE_INVALID_MESSAGE = 'La fecha de inicio no puede ser posterior a la fecha de fin.';

export function usePayrollRunForm(): UsePayrollRunFormResult {
  const { employees, loading: employeesLoading } = useActiveEmployees();
  const payrollRunRepository = usePayrollRunRepository();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [periodYear, setPeriodYear] = useState<number>(() => currentPeriod().year);
  const [periodMonth, setPeriodMonth] = useState<number>(() => currentPeriod().month);
  const [extraPayMode, setExtraPayMode] = useState<ExtraPayMode>('EXCLUDE');
  const [periodStartDate, setPeriodStartDate] = useState<string | null>(null);
  const [periodEndDate, setPeriodEndDate] = useState<string | null>(null);
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

  // Range prefill (spec "Range prefill from alta/baja clipped to month",
  // Scenarios 3/4/5): re-derived at the hook boundary from the pure
  // `resolveEffectivePeriod`, then ISO-ified for the editable inputs.
  // Re-prefills whenever the employee or the selected period changes; the
  // user is free to edit the range afterwards, before submitting.
  useEffect(() => {
    if (selectedEmployee === null) {
      setPeriodStartDate(null);
      setPeriodEndDate(null);
      return;
    }
    const effective = resolveEffectivePeriod(periodYear, periodMonth, selectedEmployee.altaDate, selectedEmployee.bajaDate);
    if (effective.daysWorked === 0) {
      setPeriodStartDate(null);
      setPeriodEndDate(null);
      return;
    }
    setPeriodStartDate(isoForDay(periodYear, periodMonth, effective.startDay));
    setPeriodEndDate(isoForDay(periodYear, periodMonth, effective.endDay));
  }, [selectedEmployee, periodYear, periodMonth]);

  // Invalid-range guard (spec Scenario 9): rejected here, BEFORE it ever
  // reaches `calculatePayrollRun`/`resolveEffectivePeriodFromRange` -- an
  // invalid range must never be passed to the derivation function.
  const rangeInvalid = periodStartDate !== null && periodEndDate !== null && periodStartDate > periodEndDate;
  const rangeError = rangeInvalid ? RANGE_INVALID_MESSAGE : null;

  const ratesResult = useMemo(() => resolveRatesConfig(periodYear), [periodYear]);
  const ratesWarning = ratesResult.ok ? null : RATES_NOT_LOADED_MESSAGE;

  const preview = useMemo<PayrollResult | null>(() => {
    if (selectedEmployee === null || !ratesResult.ok || rangeInvalid) {
      return null;
    }
    return calculatePayrollRun({
      baseGrossCents: selectedEmployee.baseGrossCents,
      ratesConfig: ratesResult.config,
      contractType: selectedEmployee.contractType,
      periodYear,
      periodMonth,
      altaDate: selectedEmployee.altaDate,
      bajaDate: selectedEmployee.bajaDate,
      extraPayMode,
      periodStartDate,
      periodEndDate,
    });
  }, [selectedEmployee, ratesResult, periodYear, periodMonth, extraPayMode, periodStartDate, periodEndDate, rangeInvalid]);

  const submit = async (): Promise<boolean> => {
    if (selectedEmployee === null) {
      setError('Selecciona un empleado.');
      return false;
    }

    if (!ratesResult.ok) {
      setError(RATES_NOT_LOADED_MESSAGE);
      return false;
    }

    if (rangeInvalid) {
      setError(RANGE_INVALID_MESSAGE);
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
        ratesConfig: ratesResult.config,
        contractType: selectedEmployee.contractType,
        periodYear,
        periodMonth,
        altaDate: selectedEmployee.altaDate,
        bajaDate: selectedEmployee.bajaDate,
        extraPayMode,
        periodStartDate,
        periodEndDate,
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
        periodStartDate,
        periodEndDate,
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
    extraPayMode,
    setExtraPayMode,
    periodStartDate,
    setPeriodStartDate,
    periodEndDate,
    setPeriodEndDate,
    rangeError,
    preview,
    ratesWarning,
    saving,
    error,
    submit,
  };
}
