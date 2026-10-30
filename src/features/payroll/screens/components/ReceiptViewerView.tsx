/**
 * Presentational (props-only) in-app receipt viewer (design ADR-7). The PDF
 * surface is injected (`PdfViewer`, resolved by the container through
 * `usePdfViewer()`), so this view imports no service and no native module.
 *
 * States: loading (overlay text + both actions disabled), loaded (actions
 * enabled per the `shareEnabled`/`mailEnabled` flags) and failed (spec
 * failure copy, no viewer and no action bar). A null `uri` is a failure: the
 * caller rejected the route params, and the native view is never mounted.
 *
 * For a protected receipt the viewer is mounted only once the password is
 * known (`awaitingPassword` false), so it can never be opened without it.
 */

import { Pressable, Text, View } from 'react-native';

import type { PdfViewerComponent } from '@/core';

import type { DispatchStatus } from '../../domain';
import { PROTECTED_RECEIPT_FAILURE_COPY } from './receiptProtectionCopy';

export type ReceiptViewerPdfState = 'loading' | 'loaded' | 'failed';

export interface ReceiptViewerViewProps {
  readonly PdfViewer: PdfViewerComponent;
  readonly uri: string | null;
  /** Open password of an encrypted file; omitted for a plain one. Forwarded to the viewer only. */
  readonly password?: string;
  /** The password is still being derived: the native viewer must NOT be mounted yet. */
  readonly awaitingPassword: boolean;
  /** The file is password-protected; selects the protected failure copy. */
  readonly protectedReceipt: boolean;
  readonly pdfState: ReceiptViewerPdfState;
  readonly onPdfLoad: (pageCount: number) => void;
  readonly onPdfFailure: () => void;
  readonly onShare: () => void;
  readonly onSendMail: () => void;
  readonly shareEnabled: boolean;
  readonly mailEnabled: boolean;
  readonly mailHint: string | null;
  readonly dispatchStatus: DispatchStatus;
  readonly dispatchError: string | null;
}

const FAILURE_COPY =
  'No se pudo mostrar el recibo. Vuelve a generarlo desde el historial de nóminas.';

export function ReceiptViewerView({
  PdfViewer,
  uri,
  password,
  awaitingPassword,
  protectedReceipt,
  pdfState,
  onPdfLoad,
  onPdfFailure,
  onShare,
  onSendMail,
  shareEnabled,
  mailEnabled,
  mailHint,
  dispatchStatus,
  dispatchError,
}: ReceiptViewerViewProps) {
  if (uri === null || pdfState === 'failed') {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 p-4">
        <Text testID="receipt-viewer-failed" className="text-center text-red-400">
          {protectedReceipt ? PROTECTED_RECEIPT_FAILURE_COPY : FAILURE_COPY}
        </Text>
      </View>
    );
  }

  const busy = dispatchStatus === 'sharing' || dispatchStatus === 'sending';
  const loading = awaitingPassword || pdfState === 'loading';
  const shareDisabled = loading || busy || !shareEnabled;
  const mailDisabled = loading || busy || !mailEnabled;

  return (
    <View className="flex-1 bg-slate-900">
      <View className="flex-1" accessibilityLabel="Recibo de salarios en PDF">
        {awaitingPassword ? null : (
          <PdfViewer
            testID="receipt-viewer-pdf"
            uri={uri}
            password={password}
            onLoad={onPdfLoad}
            onFailure={() => onPdfFailure()}
          />
        )}
        {loading ? (
          <View
            className="absolute inset-0 items-center justify-center bg-slate-900"
            accessibilityLabel="Cargando recibo"
          >
            <Text testID="receipt-viewer-loading" className="text-slate-400">
              Cargando recibo…
            </Text>
          </View>
        ) : null}
      </View>

      <View testID="receipt-viewer-actions" className="border-t border-slate-700 p-4">
        <View className="flex-row gap-4">
          <Pressable
            testID="receipt-viewer-share"
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
            testID="receipt-viewer-send"
            accessibilityRole="button"
            disabled={mailDisabled}
            onPress={onSendMail}
          >
            <Text
              className={`font-semibold ${mailDisabled ? 'text-slate-500' : 'text-emerald-400'}`}
            >
              Enviar por correo
            </Text>
          </Pressable>
        </View>
        {mailHint !== null ? (
          <Text testID="receipt-viewer-mail-hint" className="mt-1 text-slate-400">
            {mailHint}
          </Text>
        ) : null}
        {dispatchStatus === 'sent' ? (
          <Text testID="receipt-viewer-dispatch-sent" className="mt-1 text-emerald-400">
            Recibo enviado.
          </Text>
        ) : null}
        {dispatchStatus === 'failed' && dispatchError !== null ? (
          <Text testID="receipt-viewer-dispatch-failed" className="mt-1 text-red-400">
            {dispatchError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
