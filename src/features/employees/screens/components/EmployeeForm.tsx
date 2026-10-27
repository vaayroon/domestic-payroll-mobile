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

const NIF_ERROR_MESSAGES: Record<NonNullable<EmployeeFormErrors['nif']>, string> = {
  invalid: 'NIF/NIE no válido.',
};

const NAF_ERROR_MESSAGES: Record<NonNullable<EmployeeFormErrors['naf']>, string> = {
  invalid: 'NAF no válido.',
};

const GRUPO_COTIZACION_ERROR_MESSAGES: Record<
  NonNullable<EmployeeFormErrors['grupoCotizacion']>,
  string
> = {
  too_long: 'Usa como máximo 40 caracteres.',
};

/**
 * The previous wording sent users to look for the group on their alta or IDC, where this
 * Sistema Especial does not put one: its base comes from the retribution tramo scale, not
 * from a contribution group (Orden PJC/297/2026 art. 15 never mentions "grupo", and
 * art. 34 bis of the Reglamento General sobre Cotización is derogado). Confirmed against a
 * real TGSS "Resolución sobre reconocimiento de alta", which carries the NAF and the CCC
 * but no group at all. Blank is therefore the expected value here, not a missing one, so
 * the copy says so instead of framing it as something the user failed to find.
 */
const GRUPO_COTIZACION_HELPER_TEXT =
  'En el Sistema Especial de Empleados de Hogar la Tesorería General no suele asignar grupo de cotización: lo normal es dejarlo en blanco. Rellénalo solo si aparece en tu documentación de la Seguridad Social.';

const BASE_GROSS_ERROR_MESSAGES: Record<NonNullable<EmployeeFormErrors['baseGross']>, string> = {
  empty: 'Introduce el salario bruto.',
  not_a_number: 'Introduce un número válido (ej. 900 o 900,50).',
  negative: 'El importe no puede ser negativo.',
  too_many_decimals: 'Usa como máximo dos decimales.',
  not_positive: 'El salario bruto debe ser mayor que cero.',
};

const ALTA_ERROR_MESSAGES: Record<NonNullable<EmployeeFormErrors['alta']>, string> = {
  invalid_date: 'Introduce una fecha válida (AAAA-MM-DD).',
};

const BAJA_ERROR_MESSAGES: Record<NonNullable<EmployeeFormErrors['baja']>, string> = {
  invalid_date: 'Introduce una fecha válida (AAAA-MM-DD).',
  before_alta: 'La fecha de baja no puede ser anterior a la fecha de alta.',
};

const CONTRACT_TYPE_ERROR_MESSAGES: Record<NonNullable<EmployeeFormErrors['contractType']>, string> = {
  required: 'Selecciona el tipo de contrato.',
};

const CONTRACT_TYPE_LABELS: Record<'INDEFINIDO' | 'TEMPORAL', string> = {
  INDEFINIDO: 'Indefinido',
  TEMPORAL: 'Temporal',
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
        {errors.nif !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{NIF_ERROR_MESSAGES[errors.nif]}</Text>
        ) : null}
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
        {errors.naf !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{NAF_ERROR_MESSAGES[errors.naf]}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">Grupo de cotización (opcional)</Text>
        <TextInput
          testID="employee-form-grupo-cotizacion"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.grupoCotizacion}
          onChangeText={(text) => onChangeField('grupoCotizacion', text)}
          placeholder="Grupo de cotización"
          placeholderTextColor="#94a3b8"
        />
        <Text className="mt-1 text-sm text-slate-400">{GRUPO_COTIZACION_HELPER_TEXT}</Text>
        {errors.grupoCotizacion !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {GRUPO_COTIZACION_ERROR_MESSAGES[errors.grupoCotizacion]}
          </Text>
        ) : null}
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

      <View>
        <Text className="mb-1 text-slate-300">Fecha de alta (opcional)</Text>
        <TextInput
          testID="employee-form-alta"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.alta}
          onChangeText={(text) => onChangeField('alta', text)}
          placeholder="AAAA-MM-DD"
          placeholderTextColor="#94a3b8"
        />
        {errors.alta !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{ALTA_ERROR_MESSAGES[errors.alta]}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">Fecha de baja (opcional)</Text>
        <TextInput
          testID="employee-form-baja"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.baja}
          onChangeText={(text) => onChangeField('baja', text)}
          placeholder="AAAA-MM-DD"
          placeholderTextColor="#94a3b8"
        />
        {errors.baja !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{BAJA_ERROR_MESSAGES[errors.baja]}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">Tipo de contrato</Text>
        <View className="flex-row gap-2">
          {(Object.keys(CONTRACT_TYPE_LABELS) as (keyof typeof CONTRACT_TYPE_LABELS)[]).map((contractType) => {
            const selected = values.contractType === contractType;
            return (
              <Pressable
                key={contractType}
                testID={`employee-form-contract-type-${contractType}`}
                onPress={() => onChangeField('contractType', contractType)}
                className={`rounded-md px-3 py-2 ${selected ? 'bg-emerald-800' : 'bg-slate-800'}`}
              >
                <Text className={selected ? 'font-semibold text-emerald-300' : 'text-white'}>
                  {CONTRACT_TYPE_LABELS[contractType]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {errors.contractType !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{CONTRACT_TYPE_ERROR_MESSAGES[errors.contractType]}</Text>
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
