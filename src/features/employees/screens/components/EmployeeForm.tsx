/**
 * Presentational (props-only) create/edit form. Maps the domain's error
 * codes to localized messages here — the domain layer (`validateEmployeeForm`)
 * emits codes only, never UI copy.
 */

import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import {
  FormScrollView,
  RECEIPT_FILE_NAME_FORMAT_EXAMPLES,
  RECEIPT_FILE_NAME_FORMAT_IDS,
  RECEIPT_PASSWORD_MAX_LENGTH,
} from '@/core';
import { useTranslation } from '@/core/i18n';
import type { EmployeeReceiptFileNameFormat } from '@/types';

import type { EmployeeFormErrors, EmployeeFormInput, EmployeeFormSaveError } from '../../domain';

interface ReceiptFileNameOption {
  /** Suffix of the option's testID. */
  readonly key: string;
  /** What the form stores: `null` inherits the general setting. */
  readonly value: EmployeeReceiptFileNameFormat | null;
}

/**
 * Inherit first (the default for a new employee), then the random name, then one
 * row per format labelled with the example the core builder generates, so the
 * copy cannot drift from the behaviour (same source as the general setting).
 * Examples are file names, so they stay Spanish in every language.
 */
const RECEIPT_FILE_NAME_OPTIONS: readonly ReceiptFileNameOption[] = [
  { key: 'inherit', value: null },
  { key: 'auto', value: 'auto' },
  ...RECEIPT_FILE_NAME_FORMAT_IDS.map((id): ReceiptFileNameOption => ({ key: id, value: id })),
];

const CONTRACT_TYPES = ['INDEFINIDO', 'TEMPORAL'] as const;

export interface EmployeeFormProps {
  readonly values: EmployeeFormInput;
  readonly errors: EmployeeFormErrors;
  readonly onChangeField: <K extends keyof EmployeeFormInput>(
    field: K,
    value: EmployeeFormInput[K],
  ) => void;
  readonly onSubmit: () => void;
  readonly saving: boolean;
  readonly saveError: EmployeeFormSaveError | null;
  readonly submitLabel: string;
}

export function EmployeeForm({
  values,
  errors,
  onChangeField,
  onSubmit,
  saving,
  saveError,
  submitLabel,
}: EmployeeFormProps) {
  const { t } = useTranslation();
  const dateHint = t(($) => $.common.dateHint);
  const passwordMax = RECEIPT_PASSWORD_MAX_LENGTH;
  // Narrowed copies: TS drops `errors.x` narrowing inside the selector callbacks.
  const nameError = errors.name;
  const nifError = errors.nif;
  const nafError = errors.naf;
  const grupoCotizacionError = errors.grupoCotizacion;
  const baseGrossError = errors.baseGross;
  const altaError = errors.alta;
  const bajaError = errors.baja;
  const contractTypeError = errors.contractType;
  const receiptEncryptionEnabledError = errors.receiptEncryptionEnabled;
  const receiptPasswordOverrideError = errors.receiptPasswordOverride;

  const fileNameOptionLabel = (option: ReceiptFileNameOption): string => {
    if (option.value === null) {
      return t(($) => $.employees.form.fileNameOptions.inherit);
    }
    if (option.value === 'auto') {
      return t(($) => $.employees.form.fileNameOptions.auto);
    }
    return RECEIPT_FILE_NAME_FORMAT_EXAMPLES[option.value];
  };

  return (
    // Scrolls: with the protection fields the form no longer fits a small screen,
    // and the last fields must stay reachable above the keyboard.
    <FormScrollView contentContainerClassName="gap-4 p-4">
      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employees.form.labels.name)}</Text>
        <TextInput
          testID="employee-form-name"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.name}
          onChangeText={(text) => onChangeField('name', text)}
          placeholder={t(($) => $.employees.form.placeholders.name)}
          placeholderTextColor="#94a3b8"
        />
        {nameError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(($) => $.employees.form.errors.name[nameError])}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employees.form.labels.nif)}</Text>
        <TextInput
          testID="employee-form-nif"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.nif}
          onChangeText={(text) => onChangeField('nif', text)}
          placeholder={t(($) => $.employees.form.placeholders.nif)}
          placeholderTextColor="#94a3b8"
        />
        {nifError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(($) => $.employees.form.errors.nif[nifError])}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employees.form.labels.naf)}</Text>
        <TextInput
          testID="employee-form-naf"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.naf}
          onChangeText={(text) => onChangeField('naf', text)}
          placeholder={t(($) => $.employees.form.placeholders.naf)}
          placeholderTextColor="#94a3b8"
        />
        {nafError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(($) => $.employees.form.errors.naf[nafError])}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">
          {t(($) => $.employees.form.labels.grupoCotizacion)}
        </Text>
        <TextInput
          testID="employee-form-grupo-cotizacion"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.grupoCotizacion}
          onChangeText={(text) => onChangeField('grupoCotizacion', text)}
          placeholder={t(($) => $.employees.form.placeholders.grupoCotizacion)}
          placeholderTextColor="#94a3b8"
        />
        <Text className="mt-1 text-sm text-slate-400">
          {t(($) => $.employees.form.helpers.grupoCotizacion)}
        </Text>
        {grupoCotizacionError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(($) => $.employees.form.errors.grupoCotizacion[grupoCotizacionError])}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employees.form.labels.baseGross)}</Text>
        <TextInput
          testID="employee-form-base-gross"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.baseGross}
          onChangeText={(text) => onChangeField('baseGross', text)}
          placeholder={t(($) => $.employees.form.placeholders.baseGross)}
          placeholderTextColor="#94a3b8"
          keyboardType="decimal-pad"
        />
        {baseGrossError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(($) => $.employees.form.errors.baseGross[baseGrossError])}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employees.form.labels.alta)}</Text>
        <TextInput
          testID="employee-form-alta"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.alta}
          onChangeText={(text) => onChangeField('alta', text)}
          placeholder={dateHint}
          placeholderTextColor="#94a3b8"
        />
        {altaError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(($) => $.employees.form.errors.alta[altaError], { hint: dateHint })}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">{t(($) => $.employees.form.labels.baja)}</Text>
        <TextInput
          testID="employee-form-baja"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.baja}
          onChangeText={(text) => onChangeField('baja', text)}
          placeholder={dateHint}
          placeholderTextColor="#94a3b8"
        />
        {bajaError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(($) => $.employees.form.errors.baja[bajaError], { hint: dateHint })}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">
          {t(($) => $.employees.form.labels.contractType)}
        </Text>
        <View className="flex-row gap-2">
          {CONTRACT_TYPES.map((contractType) => {
            const selected = values.contractType === contractType;
            return (
              <Pressable
                key={contractType}
                testID={`employee-form-contract-type-${contractType}`}
                onPress={() => onChangeField('contractType', contractType)}
                className={`rounded-md px-3 py-2 ${selected ? 'bg-emerald-800' : 'bg-slate-800'}`}
              >
                <Text className={selected ? 'font-semibold text-emerald-300' : 'text-white'}>
                  {t(($) => $.employees.form.contractTypes[contractType])}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {contractTypeError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(($) => $.employees.form.errors.contractType[contractTypeError])}
          </Text>
        ) : null}
      </View>

      <View>
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 text-slate-300">
            {t(($) => $.employees.form.labels.receiptEncryption)}
          </Text>
          <Switch
            testID="employee-form-receipt-encryption"
            value={values.receiptEncryptionEnabled}
            onValueChange={(enabled) => onChangeField('receiptEncryptionEnabled', enabled)}
            trackColor={{ false: '#475569', true: '#047857' }}
            thumbColor="#e2e8f0"
          />
        </View>
        <Text className="mt-1 text-sm text-slate-400">
          {t(($) => $.employees.form.helpers.receiptEncryption)}
        </Text>
        {receiptEncryptionEnabledError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(
              ($) =>
                $.employees.form.errors.receiptEncryptionEnabled[receiptEncryptionEnabledError],
            )}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">
          {t(($) => $.employees.form.labels.receiptPasswordOverride)}
        </Text>
        {/* Deliberately NOT secure: the employer must be able to read what they typed. */}
        <TextInput
          testID="employee-form-receipt-password-override"
          className="rounded-md bg-slate-800 px-3 py-2 text-white"
          value={values.receiptPasswordOverride}
          onChangeText={(text) => onChangeField('receiptPasswordOverride', text)}
          placeholder={t(($) => $.employees.form.placeholders.receiptPasswordOverride)}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text className="mt-1 text-sm text-slate-400">
          {t(($) => $.employees.form.helpers.receiptPasswordOverride, { max: passwordMax })}
        </Text>
        {receiptPasswordOverrideError !== undefined ? (
          <Text className="mt-1 text-sm text-red-400">
            {t(
              ($) => $.employees.form.errors.receiptPasswordOverride[receiptPasswordOverrideError],
              { max: passwordMax },
            )}
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-slate-300">
          {t(($) => $.employees.form.labels.receiptFileName)}
        </Text>
        <View className="gap-2">
          {RECEIPT_FILE_NAME_OPTIONS.map((option) => {
            const selected = values.receiptFileNameFormat === option.value;
            return (
              <Pressable
                key={option.key}
                testID={`employee-form-receipt-file-name-${option.key}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => onChangeField('receiptFileNameFormat', option.value)}
                className={`rounded-md px-3 py-2 ${selected ? 'bg-emerald-800' : 'bg-slate-800'}`}
              >
                <Text className={selected ? 'font-semibold text-emerald-300' : 'text-white'}>
                  {fileNameOptionLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="mt-1 text-sm text-slate-400">
          {t(($) => $.employees.form.helpers.receiptFileName)}
        </Text>
      </View>

      {saveError !== null ? (
        <Text testID="employee-form-save-error" className="text-sm text-red-400">
          {t(($) => $.employees.form.saveFailed, { detail: saveError.detail })}
        </Text>
      ) : null}

      <Pressable testID="employee-form-submit" onPress={onSubmit} disabled={saving}>
        <Text
          className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}
        >
          {saving ? t(($) => $.employees.form.saving) : submitLabel}
        </Text>
      </Pressable>
    </FormScrollView>
  );
}
