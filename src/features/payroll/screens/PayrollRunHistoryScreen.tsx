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

import { useCallback, useState } from 'react';
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
  const dispatch = useReceiptDispatch(lastReceipt?.run ?? null, lastReceipt?.uri ?? null);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <PayrollRunHistoryView
      runs={runs}
      loading={loading}
      error={error}
      generating={generating}
      generateError={generateError}
      lastUri={lastReceipt?.uri ?? null}
      onGenerate={(run) => {
        void generate(run).then((result) => {
          if (result !== null) {
            setLastReceipt({ run, uri: result.uri });
          }
        });
      }}
      onOpen={() => {
        if (lastReceipt === null) {
          return;
        }
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
