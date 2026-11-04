/**
 * Language picker (design D16): Follow device / Español / English, with the
 * current choice marked. Selecting applies immediately and persists; a failed
 * write keeps the current language and shows an error mapped from a code.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useLanguagePreference, useTranslation, type SupportedLanguage } from '@/core/i18n';

type OptionId = 'device' | SupportedLanguage;

const OPTIONS: readonly { readonly id: OptionId; readonly value: SupportedLanguage | null }[] = [
  { id: 'device', value: null },
  { id: 'es', value: 'es' },
  { id: 'en', value: 'en' },
];

type LanguageErrorCode = 'save_failed';

export function LanguageSettingsScreen() {
  const { t } = useTranslation();
  const { preference, setPreference } = useLanguagePreference();
  const [errorCode, setErrorCode] = useState<LanguageErrorCode | null>(null);

  const handleSelect = async (value: SupportedLanguage | null) => {
    setErrorCode(null);
    try {
      await setPreference(value);
    } catch {
      setErrorCode('save_failed');
    }
  };

  return (
    <View className="flex-1 gap-3 bg-slate-900 p-4">
      <Text className="text-slate-300">{t(($) => $.language.description)}</Text>
      {OPTIONS.map((option) => {
        const selected = option.value === preference;
        return (
          <Pressable
            key={option.id}
            testID={`language-option-${option.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => void handleSelect(option.value)}
            className="flex-row items-center justify-between rounded-md bg-slate-800 px-3 py-3"
          >
            <Text className="text-white">{t(($) => $.language.options[option.id])}</Text>
            {selected ? (
              <Text testID={`language-option-${option.id}-selected`} className="text-emerald-400">
                {t(($) => $.language.selected)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {errorCode !== null ? (
        <Text testID="language-error" className="text-sm text-red-400">
          {t(($) => $.language.errors[errorCode])}
        </Text>
      ) : null}
    </View>
  );
}
