/**
 * Container screen for the in-app receipt viewer (design ADR-7). Validates
 * the untrusted route params, resolves the run for mail, wires
 * `useReceiptDispatch` for the action bar and renders the presentational
 * `ReceiptViewerView` with the injected PDF surface from `usePdfViewer()`.
 *
 * All hooks run unconditionally (React hook rules): invalid params become
 * `null` ids/uri, and the view renders the failure state without ever
 * mounting the native viewer. `useReceiptRun` reports `loading` on the first
 * render even for null ids, then `missing`; neither blocks the PDF.
 */

import { useState } from 'react';

import { usePdfViewer } from '@/core';

import {
  parseReceiptViewerParams,
  useReceiptDispatch,
  useReceiptPassword,
  useReceiptRun,
  type RawReceiptViewerParams,
} from '../domain';
import { MAIL_UNAVAILABLE_HINT } from './components/receiptDispatchCopy';
import { ReceiptViewerView, type ReceiptViewerPdfState } from './components/ReceiptViewerView';

const RUN_MISSING_HINT = 'No se encontró la nómina de este recibo.';

export interface ReceiptViewerScreenProps {
  readonly params: RawReceiptViewerParams;
}

interface PdfOutcome {
  readonly runId: string;
  readonly uri: string;
  readonly state: 'loaded' | 'failed';
}

export function ReceiptViewerScreen({ params }: ReceiptViewerScreenProps) {
  const parsed = parseReceiptViewerParams(params);
  const employeeId = parsed.ok ? parsed.employeeId : null;
  const runId = parsed.ok ? parsed.runId : null;
  const uri = parsed.ok ? parsed.uri : null;
  const encrypted = parsed.ok && parsed.encrypted;

  const PdfViewer = usePdfViewer();
  const { status: runStatus, run } = useReceiptRun(employeeId, runId);
  const dispatch = useReceiptDispatch(run, uri, encrypted);
  // The route carries only the non-secret flag; the password is re-derived.
  const passwordState = useReceiptPassword(employeeId, encrypted);

  // The outcome is stored with the run id and uri it was reported for, and only
  // applies while both still match the current params; any other pair is
  // treated as not reported yet, so the screen shows `loading` again.
  const [outcome, setOutcome] = useState<PdfOutcome | null>(null);
  const reportedState: ReceiptViewerPdfState =
    outcome !== null && outcome.runId === runId && outcome.uri === uri ? outcome.state : 'loading';
  // No derivable password means the file cannot be opened: fail without mounting the viewer.
  const pdfState: ReceiptViewerPdfState = passwordState.status === 'unavailable' ? 'failed' : reportedState;

  let mailHint: string | null = null;
  if (!dispatch.mailAvailable) {
    mailHint = MAIL_UNAVAILABLE_HINT;
  } else if (runStatus === 'missing') {
    mailHint = RUN_MISSING_HINT;
  }

  return (
    <ReceiptViewerView
      PdfViewer={PdfViewer}
      uri={uri}
      password={passwordState.status === 'ready' ? passwordState.password : undefined}
      awaitingPassword={passwordState.status === 'loading'}
      protectedReceipt={encrypted}
      pdfState={pdfState}
      onPdfLoad={() => {
        if (runId !== null && uri !== null) {
          setOutcome({ runId, uri, state: 'loaded' });
        }
      }}
      onPdfFailure={() => {
        if (runId !== null && uri !== null) {
          setOutcome({ runId, uri, state: 'failed' });
        }
      }}
      onShare={() => void dispatch.shareReceipt()}
      onSendMail={() => void dispatch.sendReceiptByMail()}
      shareEnabled={dispatch.sharingAvailable}
      mailEnabled={dispatch.mailAvailable && runStatus === 'ready'}
      mailHint={mailHint}
      dispatchStatus={dispatch.status}
      dispatchError={dispatch.error}
    />
  );
}
