/**
 * Container screen: owns `usePayrollRunHistory` + `useReceiptGenerator` +
 * `useReceiptDispatch` + navigation-focus refresh, renders the
 * presentational `PayrollRunHistoryView`. Mirrors `EmployeeListScreen.tsx`/
 * `PayrollRunCreateScreen.tsx`'s container/presentational split.
 *
 * The last generated receipt is tracked as a `{ run, uri }` pair that is set
 * only from a successful generation, so the banner actions and the in-app
 * viewer always get a run together with the PDF that was generated for it
 * (a failed later generation keeps the previous pair).
 */

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import type { PayrollRun } from '@/types';

import { usePayrollRunHistory, useReceiptDispatch, useReceiptGenerator } from '../domain';
import { PayrollRunHistoryView } from './components/PayrollRunHistoryView';

export interface PayrollRunHistoryScreenProps {
  readonly employeeId: string;
}

interface LastReceipt {
  readonly run: PayrollRun;
  readonly uri: string;
}

export function PayrollRunHistoryScreen({ employeeId }: PayrollRunHistoryScreenProps) {
  const { runs, loading, error, refresh } = usePayrollRunHistory(employeeId);
  const { generate, generating, error: generateError } = useReceiptGenerator();
  const [lastReceipt, setLastReceipt] = useState<LastReceipt | null>(null);
  // `generating` is shared by every row; this says WHICH row started it so only
  // that row reads "Generando…" while all of them stay disabled.
  const [generatingRunId, setGeneratingRunId] = useState<string | null>(null);
  const dispatch = useReceiptDispatch(lastReceipt?.run ?? null, lastReceipt?.uri ?? null);
  const router = useRouter();
  // Two taps landing before the viewer screen takes focus would push it twice.
  // Set on the first push, cleared when this screen regains focus.
  const navigatingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
      void refresh();
    }, [refresh]),
  );

  return (
    <PayrollRunHistoryView
      runs={runs}
      loading={loading}
      error={error}
      generating={generating}
      generatingRunId={generatingRunId}
      generateError={generateError}
      lastUri={lastReceipt?.uri ?? null}
      onGenerate={(run) => {
        setGeneratingRunId(run.id);
        void generate(run)
          .then((result) => {
            if (result !== null) {
              setLastReceipt({ run, uri: result.uri });
            }
          })
          .finally(() => setGeneratingRunId(null));
      }}
      onOpen={() => {
        if (lastReceipt === null || navigatingRef.current) {
          return;
        }
        navigatingRef.current = true;
        // Object form on purpose: the uri contains `/` and must be encoded as a param.
        router.push({
          pathname: '/payroll/receipt/[employeeId]',
          params: {
            employeeId: lastReceipt.run.employeeId,
            runId: lastReceipt.run.id,
            uri: lastReceipt.uri,
          },
        });
      }}
      onShare={() => void dispatch.shareReceipt()}
      onSendMail={() => void dispatch.sendReceiptByMail()}
      sharingAvailable={dispatch.sharingAvailable}
      mailAvailable={dispatch.mailAvailable}
      dispatchStatus={dispatch.status}
      dispatchError={dispatch.error}
    />
  );
}
