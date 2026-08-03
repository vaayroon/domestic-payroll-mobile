/**
 * Presentational (props-only) create/edit form. Maps the domain's error
 * codes to Spanish messages here — the domain layer (`validateEmployeeForm`)
 * emits codes only, never UI copy.
 */

import { Pressable, Text, TextInput, View } from 'react-native';

import type { EmployeeFormErrors, EmployeeFormInput } from '../../domain';

const NAME_ERROR_MESSAGES: Record<NonNullable<EmployeeFormErrors['name']>, string> = {
  required: 'El nombre es obligatorio.',
};

const BASE_GROSS_ERROR_MESSAGES: Record<NonNullable<EmployeeFormErrors['baseGross']>, string> = {
  empty: 'Introduce el salario bruto.',
  not_a_number: 'Introduce un número válido (ej. 900 o 900,50).',
  negative: 'El importe no puede ser negativo.',
  too_many_decimals: 'Usa como máximo dos decimales.',
  not_positive: 'El salario bruto debe ser mayor que cero.',
};

export interface EmployeeFormProps {
  readonly values: EmployeeFormInput;
  readonly errors: EmployeeFormErrors;
  readonly onChangeField: (field: keyof EmployeeFormInput, value: string) => void;
  readonly onSubmit: () => void;
  readonly saving: boolean;
  readonly saveError: string | null;
  readonly submitLabel: string;
}

export function EmployeeForm({ values, errors, onChangeField, onSubmit, saving, saveError, submitLabel }: EmployeeFormProps) {
  return (
    <View className="flex-1 gap-4 bg-slate-900 p-4">
      <View>
        <Text className="mb-1 text-slate-300">Nombre</Text>
        <TextInput
          testID="employee-form-name"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.name}
          onChangeText={(text) => onChangeField('name', text)}
          placeholder="Nombre del empleado"
          placeholderTextColor="#94a3b8"
        />
        {errors.name !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{NAME_ERROR_MESSAGES[errors.name]}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">NIF (opcional)</Text>
        <TextInput
          testID="employee-form-nif"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.nif}
          onChangeText={(text) => onChangeField('nif', text)}
          placeholder="NIF"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View>
        <Text className="mb-1 text-slate-300">NAF (opcional)</Text>
        <TextInput
          testID="employee-form-naf"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.naf}
          onChangeText={(text) => onChangeField('naf', text)}
          placeholder="NAF"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View>
        <Text className="mb-1 text-slate-300">Salario bruto</Text>
        <TextInput
          testID="employee-form-base-gross"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.baseGross}
          onChangeText={(text) => onChangeField('baseGross', text)}
          placeholder="900,00"
          placeholderTextColor="#94a3b8"
          keyboardType="decimal-pad"
        />
        {errors.baseGross !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{BASE_GROSS_ERROR_MESSAGES[errors.baseGross]}</Text>
        ) : null}
      </View>

      {saveError !== null ? (
        <Text testID="employee-form-save-error" className="text-sm text-red-400">
          No se pudo guardar: {saveError}
        </Text>
      ) : null}

      <Pressable testID="employee-form-submit" onPress={onSubmit} disabled={saving}>
        <Text className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saving ? 'Guardando…' : submitLabel}
        </Text>
      </Pressable>
    </View>
  );
}
