/**
 * Receipt-dispatch flow hook (design ADR-8): share a just-generated
 * receipt PDF via `PdfSharer`, or send it by email via `MailSender` using
 * the Spanish subject/body from `buildReceiptMailContent`. Sibling of
 * `useReceiptGenerator` -- that hook stays untouched; this one owns its own
 * `useEmployeeRepository().getById` lookup the same way.
 *
 * `run`/`uri` are nullable because the hook is called unconditionally at the
 * container top-level (React hook rules) while the banner that exposes the
 * actions only renders once a receipt was generated this session.
 */

import { useEffect, useState } from 'react';

import {
  resolveReceiptPassword,
  useEmployeeRepository,
  useMailSender,
  usePdfSharer,
  type ReceiptPasswordSource,
} from '@/core';
import type { Employee, PayrollRun } from '@/types';

import { buildReceiptMailContent } from '../receipt';

export type DispatchStatus = 'idle' | 'sharing' | 'sending' | 'sent' | 'cancelled' | 'failed';

export interface UseReceiptDispatchResult {
  readonly shareReceipt: () => Promise<void>;
  readonly sendReceiptByMail: () => Promise<void>;
  readonly sharingAvailable: boolean;
  readonly mailAvailable: boolean;
  readonly status: DispatchStatus;
  readonly error: string | null;
}

const SHARE_DIALOG_TITLE = 'Compartir recibo';

/**
 * Which wording the mail needs for an encrypted file. If the password can no
 * longer be derived (the employee's data changed after generation) the
 * 'override' wording is used: it never claims the NIF and never names a value.
 */
function passwordSourceOf(employee: Employee): ReceiptPasswordSource {
  const resolved = resolveReceiptPassword(employee);
  return resolved.ok ? resolved.source : 'override';
}

/**
 * `encrypted` says whether the file at `uri` is password-protected. It only
 * selects the mail wording; share and mail always attach the same `uri`.
 */
export function useReceiptDispatch(
  run: PayrollRun | null,
  uri: string | null,
  encrypted = false,
): UseReceiptDispatchResult {
  const employeeRepository = useEmployeeRepository();
  const pdfSharer = usePdfSharer();
  const mailSender = useMailSender();

  const [sharingAvailable, setSharingAvailable] = useState(false);
  const [mailAvailable, setMailAvailable] = useState(false);
  const [status, setStatus] = useState<DispatchStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // The status describes ONE file. When the file behind the banner changes
  // (a new generation, or "Cifrar" swapping the plain file for a protected
  // one) the previous outcome no longer applies, e.g. "Recibo enviado." must
  // not outlive the file it was about. Reset during render (React's
  // "adjusting state when a prop changes" pattern) so no stale frame is shown.
  const [dispatchedFile, setDispatchedFile] = useState({ uri, encrypted });
  if (dispatchedFile.uri !== uri || dispatchedFile.encrypted !== encrypted) {
    setDispatchedFile({ uri, encrypted });
    setStatus('idle');
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    void pdfSharer.isAvailable().then((available) => {
      if (!cancelled) {
        setSharingAvailable(available);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pdfSharer]);

  useEffect(() => {
    let cancelled = false;
    void mailSender.isAvailable().then((available) => {
      if (!cancelled) {
        setMailAvailable(available);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mailSender]);

  const shareReceipt = async (): Promise<void> => {
    if (uri === null) {
      return;
    }
    setStatus('sharing');
    setError(null);
    try {
      await pdfSharer.share(uri, { dialogTitle: SHARE_DIALOG_TITLE });
      setStatus('idle');
    } catch {
      setStatus('failed');
      setError('No se pudo compartir el recibo.');
    }
  };

  const sendReceiptByMail = async (): Promise<void> => {
    if (run === null || uri === null) {
      return;
    }
    setStatus('sending');
    setError(null);
    try {
      const employee = await employeeRepository.getById(run.employeeId);
      if (employee === null) {
        throw new Error('No se encontró el empleado de esta nómina.');
      }
      const { subject, body } = buildReceiptMailContent(run, employee, encrypted ? passwordSourceOf(employee) : null);
      const result = await mailSender.send({ subject, body, attachmentUris: [uri] });
      switch (result) {
        case 'sent':
        case 'saved':
          setStatus('sent');
          break;
        case 'cancelled':
        case 'undetermined':
          setStatus('cancelled');
          break;
      }
    } catch {
      setStatus('failed');
      setError('No se pudo enviar el recibo.');
    }
  };

  return { shareReceipt, sendReceiptByMail, sharingAvailable, mailAvailable, status, error };
}
