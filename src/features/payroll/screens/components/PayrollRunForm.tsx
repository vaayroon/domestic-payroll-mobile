/**
 * Presentational (props-only) payroll run creation form. Mirrors
 * `EmployeeForm.tsx`'s split: this component owns no state, no repository
 * access, and no engine calls -- `usePayrollRunForm` computes everything and
 * this file only renders it, formatting EUR amounts via `formatEuros`
 * (design ADR-4) at the presentation boundary.
 *
 * SS is READ-ONLY here (spec "PayrollRun consumes computed SS, not manual
 * entry"): there is no editable SS input -- the cuota is computed from the
 * employee's base gross + contract type and shown only inside the preview.
 * When the run period's year has no loaded SS rates, `ratesWarning` replaces
 * the preview entirely.
 */

import { Pressable, Text, TextInput, View } from 'react-native';

import { FormScrollView } from '@/core';
import { formatMonthYear, useTranslation } from '@/core/i18n';
import type { Employee } from '@/types';

import type { ActiveEmployeesError, ExtraPayMode, PayrollResult, PayrollRunFormError } from '../../domain';
import { formatEuros } from '../formatEuros';

const EXTRA_PAY_MODES: readonly ExtraPayMode[] = ['INCLUDE_IN_MONTH', 'PRORATE', 'EXCLUDE'];

/**
 * The '<' / '>' glyphs alone are about 8x25 dp. Extends the touch area to
 * roughly 40x49 dp, close to the 48 dp Android minimum, without changing the
 * layout. The month label in between is not pressable, so overlap is harmless.
 */
const PERIOD_STEPPER_HIT_SLOP = { top: 12, bottom: 12, left: 16, right: 16 } as const;

export interface PayrollRunFormProps {
  readonly employees: Employee[];
  readonly employeesLoading: boolean;
  /** Shown instead of the "no active employees" hint when the list could not be read. */
  readonly employeesError: ActiveEmployeesError | null;
  readonly selectedEmployeeId: string | null;
  readonly onSelectEmployee: (id: string) => void;
  readonly periodYear: number;
  readonly periodMonth: number;
  readonly onIncrementMonth: () => void;
  readonly onDecrementMonth: () => void;
  readonly extraPayMode: ExtraPayMode;
  readonly onChangeExtraPayMode: (mode: ExtraPayMode) => void;
  /** Editable per-run period date range (ISO `'YYYY-MM-DD'`), prefilled from alta/baja clipped to the selected month. */
  readonly periodStartDate: string | null;
  readonly onChangePeriodStartDate: (date: string | null) => void;
  readonly periodEndDate: string | null;
  readonly onChangePeriodEndDate: (date: string | null) => void;
  /** Code (mapped with `t`) when the start date is after the end date. */
  readonly rangeError: 'range_invalid' | null;
  readonly preview: PayrollResult | null;
  /** Code (mapped with `t`) shown instead of the preview when the period year's SS rates are not loaded. */
  readonly ratesWarning: 'rates_not_loaded' | null;
  readonly saving: boolean;
  readonly error: PayrollRunFormError | null;
  readonly onSubmit: () => void;
}

export function PayrollRunForm({
  employees,
  employeesLoading,
  employeesError,
  selectedEmployeeId,
  onSelectEmployee,
  periodYear,
  periodMonth,
  onIncrementMonth,
  onDecrementMonth,
  extraPayMode,
  onChangeExtraPayMode,
  periodStartDate,
  onChangePeriodStartDate,
  periodEndDate,
  onChangePeriodEndDate,
  rangeError,
  preview,
  ratesWarning,
  saving,
  error,
  onSubmit,
}: PayrollRunFormProps) {
  const { t } = useTranslation();

  let errorText: string | null = null;
  if (error !== null) {
    switch (error.code) {
      case 'duplicate_run':
        errorText = t(($) => $.payroll.form.errors.duplicate_run, {
          employee: error.employeeName,
          month: error.periodMonth,
          year: error.periodYear,
        });
        break;
      case 'save_failed':
        errorText = error.detail;
        break;
      case 'select_employee':
        errorText = t(($) => $.payroll.form.errors.select_employee);
        break;
      case 'rates_not_loaded':
        errorText = t(($) => $.payroll.form.errors.rates_not_loaded);
        break;
      case 'range_invalid':
        errorText = t(($) => $.payroll.form.errors.range_invalid);
        break;
    }
  }

  return (
    // Scrolls: the period range inputs and the preview push the submit button
    // below the keyboard on a small screen.
    <FormScrollView contentContainerClassName="gap-4 p-4">
      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.payroll.form.employee)}</Text>
        {employeesLoading ? (
          <Text testID="payroll-run-form-employees-loading" className="text-slate-400">
            {t(($) => $.payroll.form.employeesLoading)}
          </Text>
        ) : employeesError !== null ? (
          <View>
            <Text testID="payroll-run-form-employees-error" className="text-red-400">
              {t(($) => $.payroll.form.employeesErrors[employeesError.code])}
            </Text>
            <Text testID="payroll-run-form-employees-error-detail" className="text-sm text-slate-400">
              {employeesError.detail}
            </Text>
          </View>
        ) : employees.length === 0 ? (
          <Text testID="payroll-run-form-employees-empty" className="text-slate-400">
            {t(($) => $.payroll.form.employeesEmpty)}
          </Text>
        ) : (
          <View className="gap-2">
            {employees.map((employee) => {
              const selected = employee.id === selectedEmployeeId;
              return (
                <Pressable
                  key={employee.id}
                  testID={`payroll-run-form-employee-${employee.id}`}
                  onPress={() => onSelectEmployee(employee.id)}
                  className={`rounded-md px-3 py-2 ${selected ? 'bg-emerald-800' : 'bg-slate-800'}`}
                >
                  <Text className={selected ? 'font-semibold text-emerald-300' : 'text-white'}>{employee.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.payroll.form.period)}</Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            testID="payroll-run-form-period-prev"
            accessibilityRole="button"
            accessibilityLabel={t(($) => $.payroll.form.periodPrevious)}
            hitSlop={PERIOD_STEPPER_HIT_SLOP}
            onPress={onDecrementMonth}
          >
            <Text className="text-lg font-semibold text-emerald-400">{'<'}</Text>
          </Pressable>
          <Text testID="payroll-run-form-period-label" className="text-white">
            {formatMonthYear(t, periodYear, periodMonth)}
          </Text>
          <Pressable
            testID="payroll-run-form-period-next"
            accessibilityRole="button"
            accessibilityLabel={t(($) => $.payroll.form.periodNext)}
            hitSlop={PERIOD_STEPPER_HIT_SLOP}
            onPress={onIncrementMonth}
          >
            <Text className="text-lg font-semibold text-emerald-400">{'>'}</Text>
          </Pressable>
        </View>
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.payroll.form.range)}</Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="mb-1 text-xs text-slate-400">{t(($) => $.payroll.form.from)}</Text>
            <TextInput
              testID="payroll-run-form-period-start"
              className="rounded-md bg-slate-800 px-3 py-2 text-white"
              value={periodStartDate ?? ''}
              onChangeText={(text) => onChangePeriodStartDate(text.length > 0 ? text : null)}
              placeholder={t(($) => $.common.dateHint)}
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-xs text-slate-400">{t(($) => $.payroll.form.to)}</Text>
            <TextInput
              testID="payroll-run-form-period-end"
              className="rounded-md bg-slate-800 px-3 py-2 text-white"
              value={periodEndDate ?? ''}
              onChangeText={(text) => onChangePeriodEndDate(text.length > 0 ? text : null)}
              placeholder={t(($) => $.common.dateHint)}
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>
        {rangeError !== null ? (
          <Text testID="payroll-run-form-range-error" className="mt-1 text-sm text-red-400">
            {t(($) => $.payroll.form.errors[rangeError])}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.payroll.form.extraPay)}</Text>
        <View className="gap-2">
          {EXTRA_PAY_MODES.map((mode) => {
            const selected = mode === extraPayMode;
            return (
              <Pressable
                key={mode}
                testID={`payroll-run-form-extra-mode-${mode}`}
                onPress={() => onChangeExtraPayMode(mode)}
                className={`rounded-md px-3 py-2 ${selected ? 'bg-emerald-800' : 'bg-slate-800'}`}
              >
                <Text className={selected ? 'font-semibold text-emerald-300' : 'text-white'}>
                  {t(($) => $.payroll.form.extraPayModes[mode])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View testID="payroll-run-form-preview" className="gap-1 rounded-md bg-slate-800 p-3">
        {ratesWarning !== null ? (
          <Text testID="payroll-run-form-rates-warning" className="text-sm text-amber-400">
            {t(($) => $.payroll.form.errors[ratesWarning])}
          </Text>
        ) : preview === null ? (
          <Text testID="payroll-run-form-preview-empty" className="text-slate-400">
            {t(($) => $.payroll.form.previewEmpty)}
          </Text>
        ) : (
          <>
            <Text className="text-slate-300">
              {t(($) => $.payroll.form.gross)} <Text testID="payroll-run-form-preview-gross" className="text-white">{formatEuros(preview.grossCents)}</Text>
            </Text>
            <Text className="text-slate-300">
              {t(($) => $.payroll.form.ss)} <Text testID="payroll-run-form-preview-ss" className="text-white">{formatEuros(preview.ssDeductionCents)}</Text>
            </Text>
            <Text className="text-slate-300">
              {t(($) => $.payroll.form.net)} <Text testID="payroll-run-form-preview-net" className="text-white">{formatEuros(preview.netCents)}</Text>
            </Text>
            {preview.prorated ? (
              <Text testID="payroll-run-form-preview-prorated" className="text-sm text-amber-400">
                {t(($) => $.payroll.form.prorated)}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {errorText !== null ? (
        <Text testID="payroll-run-form-error" className="text-sm text-red-400">
          {errorText}
        </Text>
      ) : null}

      <Pressable testID="payroll-run-form-submit" onPress={onSubmit} disabled={saving}>
        <Text className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saving ? t(($) => $.payroll.form.saving) : t(($) => $.payroll.form.submit)}
        </Text>
      </Pressable>
    </FormScrollView>
  );
}
