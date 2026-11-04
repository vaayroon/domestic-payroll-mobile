/**
 * Presentational (props-only) row for one employee in the list.
 */

import { Pressable, Text, View } from 'react-native';

import { useTranslation } from '@/core/i18n';
import type { Employee } from '@/types';
import { toEuros } from '@/types/money';

const EUR_FORMATTER = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export interface EmployeeListItemProps {
  readonly employee: Employee;
  readonly onEdit: (id: string) => void;
  readonly onDeactivate: (id: string) => void;
  readonly onViewHistory: (id: string) => void;
}

export function EmployeeListItem({
  employee,
  onEdit,
  onDeactivate,
  onViewHistory,
}: EmployeeListItemProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center justify-between border-b border-slate-700 px-4 py-3">
      <View className="flex-1">
        <Text className="text-base font-semibold text-white">{employee.name}</Text>
        <Text className="text-sm text-slate-400">
          {EUR_FORMATTER.format(toEuros(employee.baseGrossCents))}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <Pressable testID="employee-list-item-history" onPress={() => onViewHistory(employee.id)}>
          <Text className="font-semibold text-emerald-400">
            {t(($) => $.employees.list.item.history)}
          </Text>
        </Pressable>
        <Pressable testID="employee-list-item-edit" onPress={() => onEdit(employee.id)}>
          <Text className="font-semibold text-emerald-400">
            {t(($) => $.employees.list.item.edit)}
          </Text>
        </Pressable>
        <Pressable testID="employee-list-item-deactivate" onPress={() => onDeactivate(employee.id)}>
          <Text className="font-semibold text-red-400">
            {t(($) => $.employees.list.item.remove)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
