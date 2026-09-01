/**
 * Presentational signature-capture screen (design ADR-5): owns
 * `useEmployerSignature` (load + save/clear) and renders the injected
 * `SignaturePad` component (resolved via `useSignaturePad()`, never a direct
 * import of the sealed adapter -- CLAUDE.md §3). Plain `View` layout, NOT a
 * `ScrollView` -- a scrollable parent would steal the drawing gesture.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useSignaturePad } from '@/core';
import type { SignaturePadControls, SignaturePadFailureCode } from '@/types';

import { useEmployerSignature } from '../domain';

const EMPTY_CANVAS_ERROR = 'Dibuja tu firma antes de guardar.';

const FAILURE_MESSAGES: Record<SignaturePadFailureCode, string> = {
  load_failed: 'No se pudo abrir el panel de firma.',
  capture_failed: 'No se pudo leer la firma.',
};

export function EmployerSignatureScreen() {
  const SignaturePad = useSignaturePad();
  const { loading, savedPngBase64, save, clear, saving, saveError } = useEmployerSignature();

  const [controls, setControls] = useState<SignaturePadControls | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleReady = (nextControls: SignaturePadControls) => {
    setControls(nextControls);
  };

  const handleCapture = (pngBase64: string) => {
    setLocalError(null);
    void save(pngBase64);
  };

  const handleEmpty = () => {
    setLocalError(EMPTY_CANVAS_ERROR);
  };

  const handleFailure = (code: SignaturePadFailureCode) => {
    setLocalError(FAILURE_MESSAGES[code]);
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
        <Text className="text-slate-300">Cargando…</Text>
      </View>
    );
  }

  const displayError = localError ?? saveError;

  return (
    <View className="flex-1 gap-4 bg-slate-900 p-4">
      <View>
        <Text className="mb-1 text-lg font-semibold text-white">Firma de la parte empleadora</Text>
        <Text className="text-sm text-slate-400">
          Dibuja tu firma una sola vez. Se añadirá automáticamente a cada recibo que generes.
        </Text>
      </View>

      <Text className="text-xs text-slate-500">La firma se guarda solo en este dispositivo.</Text>

      <Text testID="signature-settings-status" className="text-sm text-slate-300">
        {savedPngBase64 !== null ? 'Firma guardada' : 'Sin firma guardada'}
      </Text>

      <SignaturePad
        testID="signature-settings-pad"
        initialPngBase64={savedPngBase64}
        heightPx={220}
        penColor="#111827"
        onReady={handleReady}
        onCapture={handleCapture}
        onEmpty={handleEmpty}
        onFailure={handleFailure}
      />

      {displayError !== null ? (
        <Text testID="signature-settings-error" className="text-sm text-red-400">
          {displayError}
        </Text>
      ) : null}

      <Pressable testID="signature-settings-save" onPress={handleSave} disabled={saving}>
        <Text className={`text-center font-semibold ${saving ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saving ? 'Guardando…' : 'Guardar firma'}
        </Text>
      </Pressable>

      <Pressable testID="signature-settings-clear-canvas" onPress={handleClearCanvas}>
        <Text className="text-center text-slate-300">Limpiar</Text>
      </Pressable>

      <Pressable testID="signature-settings-delete" onPress={handleDeleteSaved} disabled={saving}>
        <Text className="text-center text-red-400">Borrar firma guardada</Text>
      </Pressable>
    </View>
  );
}
