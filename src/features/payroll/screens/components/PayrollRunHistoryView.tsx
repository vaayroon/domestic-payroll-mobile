/**
 * Presentational (props-only) list/loading/error/empty view for the
 * per-employee payroll run history (design ADR-5/ADR-9). Each row shows
 * período (`formatSpanishMonthYear`) + líquido a percibir (`formatEuros`);
 * selecting a row's "Generar recibo" action fires `onGenerate`. Once
 * `lastUri` is set, the success banner exposes three actions, in order:
 * "Abrir recibo" (navigates to the in-app viewer; always enabled, it does not
 * need the share sheet), "Compartir" (disabled, not hidden, when
 * `!sharingAvailable`) and "Enviar por correo" (disabled with a Spanish hint
 * when `!mailAvailable` -- disable-and-explain, not a silent share-sheet
 * fallback). Both dispatch actions are also disabled while a dispatch is
 * running (`dispatchStatus` `sharing`/`sending`). Mirrors `EmployeeListView.tsx`'s structure.
 */

import { FlatList, Pressable, Text, View } from 'react-native';

import type { PayrollRun } from '@/types';

import type { DispatchStatus } from '../../domain';
import { formatSpanishMonthYear } from '../../formatSpanishDate';
import { formatEuros } from '../formatEuros';
import { MAIL_UNAVAILABLE_HINT } from './receiptDispatchCopy';

export interface PayrollRunHistoryViewProps {
  readonly runs: PayrollRun[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly generating: boolean;
  readonly generateError: string | null;
  readonly lastUri: string | null;
  readonly onGenerate: (run: PayrollRun) => void;
  readonly onOpen: () => void;
  readonly onShare: () => void;
  readonly onSendMail: () => void;
  readonly sharingAvailable: boolean;
  readonly mailAvailable: boolean;
  readonly dispatchStatus: DispatchStatus;
  readonly dispatchError: string | null;
}

export function PayrollRunHistoryView({
  runs,
  loading,
  error,
  generating,
  generateError,
  lastUri,
  onGenerate,
  onOpen,
  onShare,
  onSendMail,
  sharingAvailable,
  mailAvailable,
  dispatchStatus,
  dispatchError,
}: PayrollRunHistoryViewProps) {
  // Same rule as `ReceiptViewerView`: no second dispatch while one is running.
  const busy = dispatchStatus === 'sharing' || dispatchStatus === 'sending';
  const shareDisabled = busy || !sharingAvailable;
  const sendDisabled = busy || !mailAvailable;

  return (
    <View className="flex-1 bg-slate-900">
      <View className="p-4">
        <Text className="text-xl font-bold text-white">Historial de nóminas</Text>
      </View>

      {error !== null ? (
        <Text testID="payroll-run-history-error" className="px-4 text-red-400">
          {error}
        </Text>
      ) : null}

      {generateError !== null ? (
        <Text testID="payroll-run-history-generate-error" className="px-4 text-red-400">
          {generateError}
        </Text>
      ) : null}

      {lastUri !== null ? (
        <View className="px-4 pb-2">
          <Text testID="payroll-run-history-success" className="text-emerald-400">
            Recibo generado.
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-4">
            <Pressable
              testID="payroll-run-history-open"
              accessibilityRole="button"
              onPress={onOpen}
            >
              <Text className="font-semibold text-emerald-400">Abrir recibo</Text>
            </Pressable>
            <Pressable
              testID="payroll-run-history-share"
              accessibilityRole="button"
              disabled={shareDisabled}
              onPress={onShare}
            >
              <Text
                className={`font-semibold ${shareDisabled ? 'text-slate-500' : 'text-emerald-400'}`}
              >
                Compartir
              </Text>
            </Pressable>
            <Pressable
              testID="payroll-run-history-send"
              accessibilityRole="button"
              disabled={sendDisabled}
              onPress={onSendMail}
            >
              <Text
                className={`font-semibold ${sendDisabled ? 'text-slate-500' : 'text-emerald-400'}`}
              >
                Enviar por correo
              </Text>
            </Pressable>
          </View>
          {!mailAvailable ? (
            <Text testID="payroll-run-history-mail-unavailable" className="mt-1 text-slate-400">
              {MAIL_UNAVAILABLE_HINT}
            </Text>
          ) : null}
          {dispatchStatus === 'sent' ? (
            <Text testID="payroll-run-history-dispatch-sent" className="mt-1 text-emerald-400">
              Recibo enviado.
            </Text>
          ) : null}
          {dispatchStatus === 'failed' && dispatchError !== null ? (
            <Text testID="payroll-run-history-dispatch-failed" className="mt-1 text-red-400">
              {dispatchError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <Text testID="payroll-run-history-loading" className="px-4 text-slate-400">
          Cargando…
        </Text>
      ) : runs.length === 0 ? (
        <Text testID="payroll-run-history-empty" className="px-4 text-slate-400">
          Aún no hay nóminas generadas para este empleado.
        </Text>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(run) => run.id}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between border-b border-slate-700 px-4 py-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">
                  {formatSpanishMonthYear(item.periodYear, item.periodMonth)}
                </Text>
                <Text className="text-sm text-slate-400">{formatEuros(item.netCents)}</Text>
              </View>
              <Pressable
                testID={`payroll-run-history-generate-${item.id}`}
                accessibilityRole="button"
                disabled={generating}
                onPress={() => onGenerate(item)}
              >
                <Text
                  className={`font-semibold ${generating ? 'text-slate-500' : 'text-emerald-400'}`}
                >
                  {generating ? 'Generando…' : 'Generar recibo'}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
