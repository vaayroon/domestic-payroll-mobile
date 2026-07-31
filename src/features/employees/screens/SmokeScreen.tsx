/**
 * Foundation slice acceptance proof (`sdd/foundation/spec`, "DB round-trip
 * smoke test" + "Utility classes render" scenarios): a single screen that
 * demonstrates the whole stack wired together end to end —
 *
 *  1. NativeWind v4 utility classes actually apply to native components
 *     (`className` props below, not a `StyleSheet`).
 *  2. The DI boundary works: this screen depends ONLY on
 *     `useSettingsRepository()` from `@/core` (an interface, never a concrete
 *     `SettingsRepositoryDrizzle`), obtained through `RepositoryProvider`
 *     which `src/app/_layout.tsx` wires to a live `expo-sqlite` connection.
 *  3. The persistence layer actually works on-device: writing a value via
 *     `SettingsRepository.set` and reading it back via `.get` must return
 *     the exact value just written — proving the migration ran and the
 *     table is queryable, not just that the provider mounted.
 *
 * This screen intentionally has NO other purpose (no CRUD UI) — that is
 * explicitly out of scope for the Foundation slice.
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useSettingsRepository } from '@/core';

const SMOKE_SETTING_KEY = 'foundation.smoke.roundtrip';

type RoundTripStatus = 'pending' | 'pass' | 'fail';

export function SmokeScreen() {
  const settingsRepository = useSettingsRepository();
  const [status, setStatus] = useState<RoundTripStatus>('pending');
  const [roundTrippedValue, setRoundTrippedValue] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runRoundTrip() {
      const writtenValue = new Date().toISOString();
      try {
        await settingsRepository.set(SMOKE_SETTING_KEY, writtenValue);
        const readValue = await settingsRepository.get(SMOKE_SETTING_KEY);
        if (cancelled) {
          return;
        }
        setRoundTrippedValue(readValue);
        setStatus(readValue === writtenValue ? 'pass' : 'fail');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setStatus('fail');
      }
    }

    void runRoundTrip();

    return () => {
      cancelled = true;
    };
  }, [settingsRepository]);

  const statusLabel = status === 'pending' ? 'Running…' : status === 'pass' ? 'PASS' : 'FAIL';
  const statusClassName =
    status === 'pass' ? 'text-emerald-400' : status === 'fail' ? 'text-red-500' : 'text-slate-400';

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-slate-900 p-4">
      <Text className="text-xl font-bold text-white">Foundation Smoke Screen</Text>
      <Text className="text-center text-base text-slate-300">Settings repository write/read round-trip</Text>
      <Text testID="smoke-status" className={`text-lg font-semibold ${statusClassName}`}>
        {statusLabel}
      </Text>
      {roundTrippedValue !== null ? (
        <Text testID="smoke-value" className="text-center text-sm text-slate-400">
          Round-tripped value: {roundTrippedValue}
        </Text>
      ) : null}
      {errorMessage !== null ? (
        <Text testID="smoke-error" className="text-center text-sm text-red-400">
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}
