/**
 * Presentational signature-capture screen (design ADR-5): owns
 * `useEmployerSignature` (load + save/clear) and renders the injected
 * `SignaturePad` component (resolved via `useSignaturePad()`, never a direct
 * import of the sealed adapter -- CLAUDE.md §3). Plain `View` layout, NOT a
 * `ScrollView` -- a scrollable parent would steal the drawing gesture.
 *
 * A successful save dismisses the screen via `router.back()`, matching every
 * other save flow in the app (`EmployeeCreateScreen`, `EmployeeEditScreen`,
 * `EmployerSettingsScreen`, `ReminderSettingsScreen`) and the fact that this
 * route is registered with `presentation: 'modal'`. Note the back call belongs
 * in `handleCapture`, not `handleSave`: the pad exports asynchronously, so the
 * press handler cannot know whether the save succeeded. `Limpiar` and
 * `Borrar firma guardada` deliberately stay put -- they manage state rather
 * than completing the screen's task.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useSignaturePad } from '@/core';
import { useTranslation } from '@/core/i18n';
import type { SignaturePadControls, SignaturePadFailureCode } from '@/types';

import { useEmployerSignature } from '../domain';

/** Errors raised on the screen itself, next to the pad's own failure codes. */
type LocalErrorCode = 'empty_canvas' | SignaturePadFailureCode;

export function EmployerSignatureScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const SignaturePad = useSignaturePad();
  const { loading, savedPngBase64, save, clear, saving, saveError } = useEmployerSignature();

  const [controls, setControls] = useState<SignaturePadControls | null>(null);
  const [localError, setLocalError] = useState<LocalErrorCode | null>(null);

  const handleReady = (nextControls: SignaturePadControls) => {
    setControls(nextControls);
  };

  const handleCapture = async (pngBase64: string) => {
    setLocalError(null);
    const success = await save(pngBase64);
    if (success) {
      router.back();
    }
  };

  const handleEmpty = () => {
    setLocalError('empty_canvas');
  };

  const handleFailure = (code: SignaturePadFailureCode) => {
    setLocalError(code);
  };

  const handleSave = () => {
    setLocalError(null);
    controls?.capture();
  };

  const handleClearCanvas = () => {
    controls?.clear();
  };

  const handleDeleteSaved = () => {
    setLocalError(null);
    void clear();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-slate-300">{t(($) => $.employer.signature.loading)}</Text>
      </View>
    );
  }

  const errorCode = localError ?? saveError;

  return (
    <View className="flex-1 gap-4 bg-slate-900 p-4">
      <View>
        <Text className="mb-1 text-lg font-semibold text-white">{t(($) => $.employer.signature.title)}</Text>
        <Text className="text-sm text-slate-400">
          {t(($) => $.employer.signature.description)}
        </Text>
      </View>

      <Text className="text-xs text-slate-500">{t(($) => $.employer.signature.deviceOnly)}</Text>

      <Text testID="signature-settings-status" className="text-sm text-slate-300">
        {savedPngBase64 !== null
          ? t(($) => $.employer.signature.status.saved)
          : t(($) => $.employer.signature.status.none)}
      </Text>

      <SignaturePad
        testID="signature-settings-pad"
        initialPngBase64={savedPngBase64}
        heightPx={220}
        penColor="#111827"
        onReady={handleReady}
        onCapture={(pngBase64) => void handleCapture(pngBase64)}
        onEmpty={handleEmpty}
        onFailure={handleFailure}
      />

      {errorCode !== null ? (
        <Text testID="signature-settings-error" className="text-sm text-red-400">
          {t(($) => $.employer.signature.errors[errorCode])}
        </Text>
      ) : null}

      <Pressable testID="signature-settings-save" onPress={handleSave} disabled={saving}>
        <Text className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saving ? t(($) => $.employer.signature.saving) : t(($) => $.employer.signature.save)}
        </Text>
      </Pressable>

      <Pressable testID="signature-settings-clear-canvas" onPress={handleClearCanvas}>
        <Text className="text-center text-slate-300">{t(($) => $.employer.signature.clear)}</Text>
      </Pressable>

      <Pressable testID="signature-settings-delete" onPress={handleDeleteSaved} disabled={saving}>
        <Text className="text-center text-red-400">{t(($) => $.employer.signature.delete)}</Text>
      </Pressable>
    </View>
  );
}
