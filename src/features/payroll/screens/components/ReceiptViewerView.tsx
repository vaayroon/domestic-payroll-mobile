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
import { useTranslation } from '@/core/i18n';

import type { DispatchStatus, ReceiptDispatchError } from '../../domain';

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
  readonly mailHint: ReceiptViewerMailHint | null;
  readonly dispatchStatus: DispatchStatus;
  readonly dispatchError: ReceiptDispatchError | null;
}

/** Why the mail action is unavailable; the view maps the code with `t`. */
export type ReceiptViewerMailHint = 'mail_unavailable' | 'run_missing';

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
  const { t } = useTranslation();

  if (uri === null || pdfState === 'failed') {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 p-4">
        <Text testID="receipt-viewer-failed" className="text-center text-red-400">
          {protectedReceipt
            ? t(($) => $.payroll.protection.viewerFailure)
            : t(($) => $.payroll.viewer.failure)}
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
      <View className="flex-1" accessibilityLabel={t(($) => $.payroll.viewer.pdfLabel)}>
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
            accessibilityLabel={t(($) => $.payroll.viewer.loadingLabel)}
          >
            <Text testID="receipt-viewer-loading" className="text-slate-400">
              {t(($) => $.payroll.viewer.loading)}
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
              {t(($) => $.payroll.history.share)}
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
              {t(($) => $.payroll.history.sendMail)}
            </Text>
          </Pressable>
        </View>
        {mailHint !== null ? (
          <Text testID="receipt-viewer-mail-hint" className="mt-1 text-slate-400">
            {mailHint === 'run_missing'
              ? t(($) => $.payroll.dispatch.runMissing)
              : t(($) => $.payroll.dispatch.mailUnavailable)}
          </Text>
        ) : null}
        {dispatchStatus === 'sent' ? (
          <Text testID="receipt-viewer-dispatch-sent" className="mt-1 text-emerald-400">
            {t(($) => $.payroll.history.sent)}
          </Text>
        ) : null}
        {dispatchStatus === 'failed' && dispatchError !== null ? (
          <Text testID="receipt-viewer-dispatch-failed" className="mt-1 text-red-400">
            {t(($) => $.payroll.dispatch.errors[dispatchError])}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
