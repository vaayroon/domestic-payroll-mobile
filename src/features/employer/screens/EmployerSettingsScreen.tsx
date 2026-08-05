/**
 * Presentational settings screen: owns `useEmployerForm` (load + edit-only
 * submit) and renders Nombre/NIF/Domicilio/CCC. Maps the domain's error
 * codes to Spanish messages here — the domain layer (`validateEmployerForm`)
 * emits codes only, never UI copy (mirrors `EmployeeForm.tsx`).
 */

import { Link, useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { EmployerFormErrors, EmployerFormInput } from '../domain';
import { useEmployerForm } from '../domain';

const NAME_ERROR_MESSAGES: Record<NonNullable<EmployerFormErrors['name']>, string> = {
  required: 'El nombre es obligatorio.',
};

const NIF_ERROR_MESSAGES: Record<NonNullable<EmployerFormErrors['nif']>, string> = {
  invalid_format: 'NIF/NIE con formato no válido.',
  invalid_checksum: 'La letra de control del NIF/NIE no es correcta.',
};

const CCC_ERROR_MESSAGES: Record<NonNullable<EmployerFormErrors['ccc']>, string> = {
  invalid_format: 'El nº de cuenta de cotización debe tener 11 o 12 dígitos.',
};

export function EmployerSettingsScreen() {
  const router = useRouter();
  const { loading, loadError, values, errors, setField, submit, saving, saveError } = useEmployerForm();

  const handleSubmit = async () => {
    const success = await submit();
    if (success) {
      router.back();
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-slate-300">Cargando…</Text>
      </View>
    );
  }

  if (loadError !== null) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 p-4">
        <Text className="text-center text-red-400">{loadError}</Text>
      </View>
    );
  }

  return (
    <EmployerForm
      values={values}
      errors={errors}
      onChangeField={setField}
      onSubmit={() => void handleSubmit()}
      saving={saving}
      saveError={saveError}
    />
  );
}

interface EmployerFormProps {
  readonly values: EmployerFormInput;
  readonly errors: EmployerFormErrors;
  readonly onChangeField: <K extends keyof EmployerFormInput>(field: K, value: EmployerFormInput[K]) => void;
  readonly onSubmit: () => void;
  readonly saving: boolean;
  readonly saveError: string | null;
}

function EmployerForm({ values, errors, onChangeField, onSubmit, saving, saveError }: EmployerFormProps) {
  return (
    <View className="flex-1 gap-4 bg-slate-900 p-4">
      <View>
        <Text className="mb-1 text-slate-300">Nombre</Text>
        <TextInput
          testID="employer-form-name"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.name}
          onChangeText={(text) => onChangeField('name', text)}
          placeholder="Nombre del empleador"
          placeholderTextColor="#94a3b8"
        />
        {errors.name !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{NAME_ERROR_MESSAGES[errors.name]}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">NIF/NIE (opcional)</Text>
        <TextInput
          testID="employer-form-nif"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.nif}
          onChangeText={(text) => onChangeField('nif', text)}
          placeholder="NIF/NIE"
          placeholderTextColor="#94a3b8"
        />
        {errors.nif !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{NIF_ERROR_MESSAGES[errors.nif]}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">Domicilio (opcional)</Text>
        <TextInput
          testID="employer-form-address"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.address}
          onChangeText={(text) => onChangeField('address', text)}
          placeholder="Domicilio"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View>
        <Text className="mb-1 text-slate-300">Nº cuenta cotización (opcional)</Text>
        <TextInput
          testID="employer-form-ccc"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.ccc}
          onChangeText={(text) => onChangeField('ccc', text)}
          placeholder="Nº S.S. / CCC"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
        />
        {errors.ccc !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{CCC_ERROR_MESSAGES[errors.ccc]}</Text>
        ) : null}
      </View>

      {saveError !== null ? (
        <Text testID="employer-form-save-error" className="text-sm text-red-400">
          No se pudo guardar: {saveError}
        </Text>
      ) : null}

      <Pressable testID="employer-form-submit" onPress={onSubmit} disabled={saving}>
        <Text className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Text>
      </Pressable>

      <Link href="/settings/reminder" testID="employer-form-reminder-link" className="text-center">
        <Text className="text-emerald-400">Recordatorio mensual</Text>
      </Link>
    </View>
  );
}
