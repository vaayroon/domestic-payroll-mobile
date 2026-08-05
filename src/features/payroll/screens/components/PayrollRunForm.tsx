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

import type { Employee } from '@/types';

import type { ExtraPayMode, PayrollResult } from '../../domain';
import { formatSpanishMonthYear } from '../../formatSpanishDate';
import { formatEuros } from '../formatEuros';

const EXTRA_PAY_MODE_LABELS: Record<ExtraPayMode, string> = {
  INCLUDE_IN_MONTH: 'Incluir en el mes (junio/diciembre)',
  PRORATE: 'Prorratear cada mes',
  EXCLUDE: 'Excluir',
};

export interface PayrollRunFormProps {
  readonly employees: Employee[];
  readonly employeesLoading: boolean;
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
  /** Spanish validation error when the start date is after the end date. */
  readonly rangeError: string | null;
  readonly preview: PayrollResult | null;
  /** Spanish warning shown instead of the preview when the period year's SS rates are not loaded. */
  readonly ratesWarning: string | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly onSubmit: () => void;
}

export function PayrollRunForm({
  employees,
  employeesLoading,
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
  return (
    <View className="flex-1 gap-4 bg-slate-900 p-4">
      <View>
        <Text className="mb-1 text-slate-300">Empleado</Text>
        {employeesLoading ? (
          <Text testID="payroll-run-form-employees-loading" className="text-slate-400">
            Cargando empleados…
          </Text>
        ) : employees.length === 0 ? (
          <Text testID="payroll-run-form-employees-empty" className="text-slate-400">
            No hay empleados activos. Añade uno primero.
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
        <Text className="mb-1 text-slate-300">Periodo</Text>
        <View className="flex-row items-center gap-3">
          <Pressable testID="payroll-run-form-period-prev" onPress={onDecrementMonth}>
            <Text className="text-lg font-semibold text-emerald-400">{'<'}</Text>
          </Pressable>
          <Text testID="payroll-run-form-period-label" className="text-white">
            {formatSpanishMonthYear(periodYear, periodMonth)}
          </Text>
          <Pressable testID="payroll-run-form-period-next" onPress={onIncrementMonth}>
            <Text className="text-lg font-semibold text-emerald-400">{'>'}</Text>
          </Pressable>
        </View>
      </View>

      <View>
        <Text className="mb-1 text-slate-300">Rango de días trabajados</Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="mb-1 text-xs text-slate-400">Desde</Text>
            <TextInput
              testID="payroll-run-form-period-start"
              className="rounded-md bg-slate-800 px-3 py-2 text-white"
              value={periodStartDate ?? ''}
              onChangeText={(text) => onChangePeriodStartDate(text.length > 0 ? text : null)}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-xs text-slate-400">Hasta</Text>
            <TextInput
              testID="payroll-run-form-period-end"
              className="rounded-md bg-slate-800 px-3 py-2 text-white"
              value={periodEndDate ?? ''}
              onChangeText={(text) => onChangePeriodEndDate(text.length > 0 ? text : null)}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>
        {rangeError !== null ? (
          <Text testID="payroll-run-form-range-error" className="mt-1 text-sm text-red-400">
            {rangeError}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">Pagas extra</Text>
        <View className="gap-2">
          {(Object.keys(EXTRA_PAY_MODE_LABELS) as ExtraPayMode[]).map((mode) => {
            const selected = mode === extraPayMode;
            return (
              <Pressable
                key={mode}
                testID={`payroll-run-form-extra-mode-${mode}`}
                onPress={() => onChangeExtraPayMode(mode)}
                className={`rounded-md px-3 py-2 ${selected ? 'bg-emerald-800' : 'bg-slate-800'}`}
              >
                <Text className={selected ? 'font-semibold text-emerald-300' : 'text-white'}>
                  {EXTRA_PAY_MODE_LABELS[mode]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View testID="payroll-run-form-preview" className="gap-1 rounded-md bg-slate-800 p-3">
        {ratesWarning !== null ? (
          <Text testID="payroll-run-form-rates-warning" className="text-sm text-amber-400">
            {ratesWarning}
          </Text>
        ) : preview === null ? (
          <Text testID="payroll-run-form-preview-empty" className="text-slate-400">
            Selecciona un empleado para ver la vista previa.
          </Text>
        ) : (
          <>
            <Text className="text-slate-300">
              Bruto: <Text testID="payroll-run-form-preview-gross" className="text-white">{formatEuros(preview.grossCents)}</Text>
            </Text>
            <Text className="text-slate-300">
              SS: <Text testID="payroll-run-form-preview-ss" className="text-white">{formatEuros(preview.ssDeductionCents)}</Text>
            </Text>
            <Text className="text-slate-300">
              Neto: <Text testID="payroll-run-form-preview-net" className="text-white">{formatEuros(preview.netCents)}</Text>
            </Text>
            {preview.prorated ? (
              <Text testID="payroll-run-form-preview-prorated" className="text-sm text-amber-400">
                Mes prorrateado.
              </Text>
            ) : null}
          </>
        )}
      </View>

      {error !== null ? (
        <Text testID="payroll-run-form-error" className="text-sm text-red-400">
          {error}
        </Text>
      ) : null}

      <Pressable testID="payroll-run-form-submit" onPress={onSubmit} disabled={saving}>
        <Text className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saving ? 'Guardando…' : 'Calcular y guardar nómina'}
        </Text>
      </Pressable>
    </View>
  );
}
