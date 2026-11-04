/**
 * Settings screen for the general receipt file-name format (design D2/D3 of
 * `sdd/receipt-file-name`). Owns `useReceiptFileNameSetting`: a radio-style
 * list with the automatic (random) name first, then one row per format
 * labelled with the example the core builder generates, so the copy can never
 * drift from the behaviour. Pressing a row only stages it; the save button persists
 * and then goes back. Chrome copy is localized; the example file names stay Spanish.
 */

import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import {
  FormScrollView,
  RECEIPT_FILE_NAME_FORMAT_EXAMPLES,
  RECEIPT_FILE_NAME_FORMAT_IDS,
} from '@/core';
import { useTranslation } from '@/core/i18n';
import type { ReceiptFileNameFormatId } from '@/types';

import { useReceiptFileNameSetting } from '../domain';

interface OptionRowProps {
  readonly testID: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}

function OptionRow({ testID, label, selected, onPress }: OptionRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`rounded-md px-3 py-2 ${selected ? 'bg-emerald-800' : 'bg-slate-800'}`}
    >
      <Text className={selected ? 'font-semibold text-emerald-300' : 'text-white'}>{label}</Text>
    </Pressable>
  );
}

export function ReceiptFileNameSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { loading, value, select, submit, saving, saveError } = useReceiptFileNameSetting();

  const handleSubmit = async () => {
    const success = await submit();
    if (success) {
      router.back();
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-slate-300">{t(($) => $.employer.receiptFileName.loading)}</Text>
      </View>
    );
  }

  return (
    <FormScrollView contentContainerClassName="gap-4 p-4">
      <View>
        <Text className="mb-1 text-lg font-semibold text-white">{t(($) => $.employer.receiptFileName.title)}</Text>
        <Text className="text-sm text-slate-400">{t(($) => $.employer.receiptFileName.helper)}</Text>
      </View>

      <View className="gap-2">
        <OptionRow
          testID="receipt-file-name-option-default"
          label={t(($) => $.employer.receiptFileName.defaultOption)}
          selected={value === null}
          onPress={() => select(null)}
        />
        {RECEIPT_FILE_NAME_FORMAT_IDS.map((id: ReceiptFileNameFormatId) => (
          <OptionRow
            key={id}
            testID={`receipt-file-name-option-${id}`}
            label={RECEIPT_FILE_NAME_FORMAT_EXAMPLES[id]}
            selected={value === id}
            onPress={() => select(id)}
          />
        ))}
      </View>

      {saveError !== null ? (
        <Text testID="receipt-file-name-save-error" className="text-sm text-red-400">
          {t(($) => $.employer.receiptFileName.errors[saveError])}
        </Text>
      ) : null}

      <Pressable
        testID="receipt-file-name-submit"
        onPress={() => void handleSubmit()}
        disabled={saving}
      >
        <Text
          className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}
        >
          {saving ? t(($) => $.employer.receiptFileName.saving) : t(($) => $.employer.receiptFileName.submit)}
        </Text>
      </Pressable>
    </FormScrollView>
  );
}
