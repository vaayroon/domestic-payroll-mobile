/**
 * Container screen: owns `usePayrollRunHistory` + `useReceiptGenerator` +
 * `useReceiptDispatch` + navigation-focus refresh, renders the
 * presentational `PayrollRunHistoryView`. Mirrors `EmployeeListScreen.tsx`/
 * `PayrollRunCreateScreen.tsx`'s container/presentational split.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { PayrollRun } from '@/types';

import { usePayrollRunHistory, useReceiptDispatch, useReceiptGenerator } from '../domain';
import { PayrollRunHistoryView } from './components/PayrollRunHistoryView';

export interface PayrollRunHistoryScreenProps {
  readonly employeeId: string;
}

export function PayrollRunHistoryScreen({ employeeId }: PayrollRunHistoryScreenProps) {
  const { runs, loading, error, refresh } = usePayrollRunHistory(employeeId);
  const { generate, generating, error: generateError, lastUri } = useReceiptGenerator();
  const [lastRun, setLastRun] = useState<PayrollRun | null>(null);
  const dispatch = useReceiptDispatch(lastRun, lastUri);

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
      lastUri={lastUri}
      onGenerate={(run) => {
        setLastRun(run);
        void generate(run);
      }}
      onOpen={() => void dispatch.shareReceipt()}
      onSend={() => void dispatch.sendReceiptByMail()}
      sharingAvailable={dispatch.sharingAvailable}
      mailAvailable={dispatch.mailAvailable}
      dispatchStatus={dispatch.status}
      dispatchError={dispatch.error}
    />
  );
}
