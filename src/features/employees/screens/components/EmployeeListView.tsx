/**
 * Presentational (props-only) list/empty/loading/error view for the
 * employees home route. NativeWind `className`s only, no `StyleSheet`.
 */

import { FlatList, Pressable, Text, View } from 'react-native';

import type { Employee } from '@/types';

import { EmployeeListItem } from './EmployeeListItem';

export interface EmployeeListViewProps {
  readonly employees: Employee[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly onAdd: () => void;
  readonly onEdit: (id: string) => void;
  readonly onDeactivate: (id: string) => void;
  readonly onNewPayrollRun: () => void;
  readonly onViewHistory: (id: string) => void;
}

export function EmployeeListView({
  employees,
  loading,
  error,
  onAdd,
  onEdit,
  onDeactivate,
  onNewPayrollRun,
  onViewHistory,
}: EmployeeListViewProps) {
  return (
    <View className="flex-1 bg-slate-900">
      <View className="flex-row items-center justify-between p-4">
        <Text className="text-xl font-bold text-white">Empleados</Text>
        <View className="flex-row gap-3">
          <Pressable testID="new-payroll-run-button" onPress={onNewPayrollRun}>
            <Text className="font-semibold text-emerald-400">Nueva nómina</Text>
          </Pressable>
          <Pressable testID="add-employee-button" onPress={onAdd}>
            <Text className="font-semibold text-emerald-400">Añadir empleado</Text>
          </Pressable>
        </View>
      </View>

      {error !== null ? (
        <Text testID="employee-list-error" className="px-4 text-red-400">
          {error}
        </Text>
      ) : null}

      {loading ? (
        <Text testID="employee-list-loading" className="px-4 text-slate-400">
          Cargando…
        </Text>
      ) : employees.length === 0 ? (
        <Text testID="employee-list-empty" className="px-4 text-slate-400">
          No hay empleados. Añade el primero.
        </Text>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(employee) => employee.id}
          renderItem={({ item }) => (
            <EmployeeListItem employee={item} onEdit={onEdit} onDeactivate={onDeactivate} onViewHistory={onViewHistory} />
          )}
        />
      )}
    </View>
  );
}
