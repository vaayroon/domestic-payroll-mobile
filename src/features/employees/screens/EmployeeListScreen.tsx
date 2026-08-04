/**
 * Container screen: owns `useEmployees` + navigation, renders the
 * presentational `EmployeeListView`. Refreshes on focus (e.g. returning from
 * the create/edit modals) since there is no global employee store.
 */

import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { useEmployees } from '../domain';
import { EmployeeListView } from './components/EmployeeListView';

export function EmployeeListScreen() {
  const router = useRouter();
  const { employees, loading, error, refresh, deactivate } = useEmployees();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <EmployeeListView
      employees={employees}
      loading={loading}
      error={error}
      onAdd={() => router.push('/employees/new')}
      onEdit={(id) => router.push(`/employees/${id}/edit`)}
      onDeactivate={(id) => void deactivate(id)}
      onNewPayrollRun={() => router.push('/payroll/new')}
      onViewHistory={(id) => router.push(`/payroll/history/${id}`)}
    />
  );
}
