/**
 * Presentational settings screen: owns `useEmployerForm` (load + edit-only
 * submit) and renders Nombre/NIF/Domicilio/CCC. Maps the domain's error
 * codes to localized messages here — the domain layer (`validateEmployerForm`)
 * emits codes only, never UI copy (mirrors `EmployeeForm.tsx`).
 */

import { Link, useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FormScrollView } from '@/core';
import { useTranslation } from '@/core/i18n';

import type { EmployerFormErrors, EmployerFormInput, EmployerFormSaveError } from '../domain';
import { useEmployerForm } from '../domain';

export function EmployerSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
        <Text className="text-slate-300">{t(($) => $.employer.settings.loading)}</Text>
      </View>
    );
  }

  if (loadError !== null) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 p-4">
        <Text testID="employer-settings-load-error" className="text-center text-red-400">
          {t(($) => $.employer.errors.load[loadError.code])}
        </Text>
        {loadError.code === 'read_failed' ? (
          <Text testID="employer-settings-load-error-detail" className="mt-1 text-center text-sm text-slate-400">
            {loadError.detail}
          </Text>
        ) : null}
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
  readonly saveError: EmployerFormSaveError | null;
}

function EmployerForm({ values, errors, onChangeField, onSubmit, saving, saveError }: EmployerFormProps) {
  const { t } = useTranslation();
  const nameError = errors.name;
  const nifError = errors.nif;
  const cccError = errors.ccc;

  return (
    // Scrolls: five inputs plus three links no longer fit a small screen, and
    // the last ones must stay reachable above the keyboard.
    <FormScrollView contentContainerClassName="gap-4 p-4">
      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employer.settings.labels.name)}</Text>
        <TextInput
          testID="employer-form-name"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.name}
          onChangeText={(text) => onChangeField('name', text)}
          placeholder={t(($) => $.employer.settings.placeholders.name)}
          placeholderTextColor="#94a3b8"
        />
        {nameError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{t(($) => $.employer.errors.name[nameError])}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employer.settings.labels.nif)}</Text>
        <TextInput
          testID="employer-form-nif"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.nif}
          onChangeText={(text) => onChangeField('nif', text)}
          placeholder={t(($) => $.employer.settings.placeholders.nif)}
          placeholderTextColor="#94a3b8"
        />
        {nifError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{t(($) => $.employer.errors.nif[nifError])}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employer.settings.labels.address)}</Text>
        <TextInput
          testID="employer-form-address"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.address}
          onChangeText={(text) => onChangeField('address', text)}
          placeholder={t(($) => $.employer.settings.placeholders.address)}
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employer.settings.labels.ccc)}</Text>
        <TextInput
          testID="employer-form-ccc"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.ccc}
          onChangeText={(text) => onChangeField('ccc', text)}
          placeholder={t(($) => $.employer.settings.placeholders.ccc)}
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
        />
        {cccError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">{t(($) => $.employer.errors.ccc[cccError])}</Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employer.settings.labels.defaultLugar)}</Text>
        <TextInput
          testID="employer-form-default-lugar"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.defaultLugar}
          onChangeText={(text) => onChangeField('defaultLugar', text)}
          placeholder={t(($) => $.employer.settings.placeholders.defaultLugar)}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {saveError !== null ? (
        <Text testID="employer-form-save-error" className="text-sm text-red-400">
          {t(($) => $.employer.settings.saveFailed, { detail: saveError.detail })}
        </Text>
      ) : null}

      <Pressable testID="employer-form-submit" onPress={onSubmit} disabled={saving}>
        <Text className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saving ? t(($) => $.employer.settings.saving) : t(($) => $.employer.settings.submit)}
        </Text>
      </Pressable>

      <Link href="/settings/reminder" testID="employer-form-reminder-link" className="text-center">
        <Text className="text-emerald-400">{t(($) => $.employer.settings.links.reminder)}</Text>
      </Link>

      <Link href="/settings/signature" testID="employer-form-signature-link" className="text-center">
        <Text className="text-emerald-400">{t(($) => $.employer.settings.links.signature)}</Text>
      </Link>

      <Link href="/settings/receipt-file-name" testID="employer-form-receipt-file-name-link" className="text-center">
        <Text className="text-emerald-400">{t(($) => $.employer.settings.links.receiptFileName)}</Text>
      </Link>

      <Link href="/settings/language" testID="employer-form-language-link" className="text-center">
        <Text className="text-emerald-400">{t(($) => $.language.link)}</Text>
      </Link>
    </FormScrollView>
  );
}
