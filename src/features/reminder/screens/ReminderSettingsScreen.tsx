/**
 * Presentational settings screen: owns `useReminderSettings` (load + save)
 * and renders the enable toggle, day-of-month and time entry, and the
 * permission-denied banner. All user-facing copy comes from the i18n catalogs.
 * Day/hour/minute use plain numeric `TextInput`s (mirrors the CCC field in
 * `EmployerSettingsScreen`) rather than a native picker component -- no new
 * UI dependency is warranted for three bounded integers.
 */

import { useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FormScrollView } from '@/core';
import { useTranslation } from '@/core/i18n';

import { useReminderSettings } from '../hooks';

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function ReminderSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { loading, values, setEnabled, setDayOfMonth, setHour, setMinute, submit, saving, saveError, permissionDenied } =
    useReminderSettings();

  const handleSubmit = async () => {
    const success = await submit();
    if (success) {
      router.back();
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-slate-300">{t(($) => $.reminder.screen.loading)}</Text>
      </View>
    );
  }

  return (
    // Scrolls so the save button stays reachable above the numeric keyboard.
    <FormScrollView contentContainerClassName="gap-4 p-4">
      <View>
        <Text className="mb-1 text-lg font-semibold text-white">{t(($) => $.reminder.screen.title)}</Text>
        <Text className="text-sm text-slate-400">
          {t(($) => $.reminder.screen.description)}
        </Text>
      </View>

      <Pressable
        testID="reminder-settings-toggle"
        onPress={() => setEnabled(!values.enabled)}
        className={`rounded-md px-3 py-2 ${values.enabled ? 'bg-emerald-800' : 'bg-slate-800'}`}
      >
        <Text className={values.enabled ? 'font-semibold text-emerald-300' : 'text-white'}>
          {values.enabled ? t(($) => $.reminder.screen.toggleOn) : t(($) => $.reminder.screen.toggleOff)}
        </Text>
      </Pressable>

      {values.enabled ? (
        <>
          <View>
            <Text className="mb-1 text-slate-300">{t(($) => $.reminder.screen.dayOfMonth)}</Text>
            <TextInput
              testID="reminder-settings-day"
              className="rounded-md bg-slate-800 px-3 py-2 text-white"
              value={String(values.dayOfMonth)}
              onChangeText={(text) => setDayOfMonth(Number(text))}
              placeholder="1-31"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
            />
          </View>

          <View>
            <Text className="mb-1 text-slate-300">{t(($) => $.reminder.screen.time)}</Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                testID="reminder-settings-hour"
                className="w-16 rounded-md bg-slate-800 px-3 py-2 text-center text-white"
                value={pad2(values.hour)}
                onChangeText={(text) => setHour(Number(text))}
                placeholder="09"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
              />
              <Text className="text-slate-300">:</Text>
              <TextInput
                testID="reminder-settings-minute"
                className="w-16 rounded-md bg-slate-800 px-3 py-2 text-center text-white"
                value={pad2(values.minute)}
                onChangeText={(text) => setMinute(Number(text))}
                placeholder="00"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
              />
            </View>
          </View>
        </>
      ) : null}

      {permissionDenied ? (
        <Text testID="reminder-settings-denied-banner" className="text-sm text-amber-400">
          {t(($) => $.reminder.screen.deniedBanner)}
        </Text>
      ) : null}

      {saveError !== null ? (
        <Text testID="reminder-settings-save-error" className="text-sm text-red-400">
          {t(($) => $.reminder.screen.saveFailed, { detail: saveError })}
        </Text>
      ) : null}

      <Pressable testID="reminder-settings-submit" onPress={() => void handleSubmit()} disabled={saving}>
        <Text className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saving ? t(($) => $.reminder.screen.saving) : t(($) => $.reminder.screen.submit)}
        </Text>
      </Pressable>
    </FormScrollView>
  );
}
