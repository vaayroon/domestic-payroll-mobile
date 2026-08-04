/**
 * Container screen: owns `usePayrollRunHistory` + `useReceiptGenerator` +
 * navigation-focus refresh, renders the presentational
 * `PayrollRunHistoryView`. Mirrors `EmployeeListScreen.tsx`/
 * `PayrollRunCreateScreen.tsx`'s container/presentational split.
 */

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { usePayrollRunHistory, useReceiptGenerator } from '../domain';
import { PayrollRunHistoryView } from './components/PayrollRunHistoryView';

export interface PayrollRunHistoryScreenProps {
  readonly employeeId: string;
}

export function PayrollRunHistoryScreen({ employeeId }: PayrollRunHistoryScreenProps) {
  const { runs, loading, error, refresh } = usePayrollRunHistory(employeeId);
  const { generate, generating, error: generateError, lastUri } = useReceiptGenerator();

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
      onGenerate={(run) => void generate(run)}
    />
  );
}
