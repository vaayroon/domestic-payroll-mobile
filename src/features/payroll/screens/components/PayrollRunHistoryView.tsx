/**
 * Presentational (props-only) list/loading/error/empty view for the
 * per-employee payroll run history (design ADR-5/ADR-9). Each row shows
 * período (`formatMonthYear`) + líquido a percibir (`formatEuros`);
 * selecting a row's "Generar recibo" action fires `onGenerate`. Once
 * `lastUri` is set, the success banner exposes three actions, in order:
 * "Abrir recibo" (navigates to the in-app viewer; always enabled, it does not
 * need the share sheet), "Compartir" (disabled, not hidden, when
 * `!sharingAvailable`) and "Enviar por correo" (disabled with a Spanish hint
 * when `!mailAvailable` -- disable-and-explain, not a silent share-sheet
 * fallback). Both dispatch actions are also disabled while a dispatch is
 * running (`dispatchStatus` `sharing`/`sending`). While the file is plain
 * (`!lastEncrypted`) a fourth action, "Cifrar", regenerates it as a protected
 * receipt; it is disabled while any generation runs or a share/mail is in progress. Mirrors `EmployeeListView.tsx`'s structure.
 */

import { FlatList, Pressable, Text, View } from 'react-native';

import { formatMonthYear, useTranslation } from '@/core/i18n';
import type { PayrollRun } from '@/types';

import type { DispatchStatus, PayrollRunHistoryError, ReceiptDispatchError, ReceiptGenerationError } from '../../domain';
import { formatEuros } from '../formatEuros';

export interface PayrollRunHistoryViewProps {
  readonly runs: PayrollRun[];
  readonly loading: boolean;
  readonly error: PayrollRunHistoryError | null;
  /** A generation is running: every "Generar recibo" row is disabled. */
  readonly generating: boolean;
  /** The run whose row started the generation; only that row reads "Generando…". */
  readonly generatingRunId: string | null;
  readonly generateError: ReceiptGenerationError | null;
  readonly lastUri: string | null;
  /** The file behind `lastUri` is password-protected (in-memory state, never persisted). */
  readonly lastEncrypted: boolean;
  readonly onGenerate: (run: PayrollRun) => void;
  readonly onOpen: () => void;
  readonly onShare: () => void;
  readonly onSendMail: () => void;
  /** Regenerates the plain receipt as a protected one ("Cifrar"). */
  readonly onEncrypt: () => void;
  readonly sharingAvailable: boolean;
  readonly mailAvailable: boolean;
  readonly dispatchStatus: DispatchStatus;
  readonly dispatchError: ReceiptDispatchError | null;
}

export function PayrollRunHistoryView({
  runs,
  loading,
  error,
  generating,
  generatingRunId,
  generateError,
  lastUri,
  lastEncrypted,
  onGenerate,
  onOpen,
  onShare,
  onSendMail,
  onEncrypt,
  sharingAvailable,
  mailAvailable,
  dispatchStatus,
  dispatchError,
}: PayrollRunHistoryViewProps) {
  const { t } = useTranslation();
  // Same rule as `ReceiptViewerView`: no second dispatch while one is running.
  const busy = dispatchStatus === 'sharing' || dispatchStatus === 'sending';
  const shareDisabled = busy || !sharingAvailable;
  const sendDisabled = busy || !mailAvailable;
  // "Cifrar" swaps the file under the banner: never while a generation runs or
  // while the current file is being shared or mailed.
  const encryptDisabled = generating || busy;

  return (
    <View className="flex-1 bg-slate-900">
      <View className="p-4">
        <Text className="text-xl font-bold text-white">{t(($) => $.payroll.history.title)}</Text>
      </View>

      {error !== null ? (
        <View className="px-4">
          <Text testID="payroll-run-history-error-message" className="text-red-400">
            {t(($) => $.payroll.history.errors[error.code])}
          </Text>
          {/* Technical detail as a secondary line (untranslated). */}
          <Text testID="payroll-run-history-error" className="text-sm text-slate-400">
            {error.detail}
          </Text>
        </View>
      ) : null}

      {generateError !== null ? (
        <Text testID="payroll-run-history-generate-error" className="px-4 text-red-400">
          {generateError.code === 'failed'
            ? generateError.detail
            : t(($) => $.payroll.generate.errors[generateError.code])}
        </Text>
      ) : null}

      {lastUri !== null ? (
        <View className="px-4 pb-2">
          <Text testID="payroll-run-history-success" className="text-emerald-400">
            {lastEncrypted ? t(($) => $.payroll.protection.generatedProtected) : t(($) => $.payroll.history.generated)}
          </Text>
          {lastEncrypted ? (
            <Text testID="payroll-run-history-protected-hint" className="mt-1 text-slate-400">
              {t(($) => $.payroll.protection.hint)}
            </Text>
          ) : null}
          <View className="mt-2 flex-row flex-wrap gap-4">
            <Pressable
              testID="payroll-run-history-open"
              accessibilityRole="button"
              onPress={onOpen}
            >
              <Text className="font-semibold text-emerald-400">{t(($) => $.payroll.history.open)}</Text>
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
                {t(($) => $.payroll.history.share)}
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
                {t(($) => $.payroll.history.sendMail)}
              </Text>
            </Pressable>
            {!lastEncrypted ? (
              <Pressable
                testID="payroll-run-history-encrypt"
                accessibilityRole="button"
                disabled={encryptDisabled}
                onPress={onEncrypt}
              >
                <Text
                  className={`font-semibold ${encryptDisabled ? 'text-slate-500' : 'text-emerald-400'}`}
                >
                  {t(($) => $.payroll.history.encrypt)}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {!mailAvailable ? (
            <Text testID="payroll-run-history-mail-unavailable" className="mt-1 text-slate-400">
              {t(($) => $.payroll.dispatch.mailUnavailable)}
            </Text>
          ) : null}
          {dispatchStatus === 'sent' ? (
            <Text testID="payroll-run-history-dispatch-sent" className="mt-1 text-emerald-400">
              {t(($) => $.payroll.history.sent)}
            </Text>
          ) : null}
          {dispatchStatus === 'failed' && dispatchError !== null ? (
            <Text testID="payroll-run-history-dispatch-failed" className="mt-1 text-red-400">
              {t(($) => $.payroll.dispatch.errors[dispatchError])}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <Text testID="payroll-run-history-loading" className="px-4 text-slate-400">
          {t(($) => $.payroll.history.loading)}
        </Text>
      ) : runs.length === 0 ? (
        <Text testID="payroll-run-history-empty" className="px-4 text-slate-400">
          {t(($) => $.payroll.history.empty)}
        </Text>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(run) => run.id}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between border-b border-slate-700 px-4 py-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">
                  {formatMonthYear(t, item.periodYear, item.periodMonth)}
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
                  {generating && generatingRunId === item.id
                    ? t(($) => $.payroll.history.generating)
                    : t(($) => $.payroll.history.generate)}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
