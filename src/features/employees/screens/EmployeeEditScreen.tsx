/**
 * Container screen: owns `useEmployee` (prefill loader) + navigation. The
 * form itself is a separate inner component so `useEmployeeForm` is only
 * called once the employee has loaded (never conditionally, keeping the
 * Rules of Hooks intact).
 */

import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useTranslation } from '@/core/i18n';
import type { Employee } from '@/types';

import { useEmployee, useEmployeeForm } from '../domain';
import { EmployeeForm } from './components/EmployeeForm';

export interface EmployeeEditScreenProps {
  readonly employeeId: string;
}

export function EmployeeEditScreen({ employeeId }: EmployeeEditScreenProps) {
  const { t } = useTranslation();
  const { employee, loading, error } = useEmployee(employeeId);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-slate-300">{t(($) => $.employees.edit.loading)}</Text>
      </View>
    );
  }

  if (error !== null) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 p-4">
        <Text testID="employee-edit-error-message" className="text-center text-red-400">
          {t(($) => $.employees.edit.errors[error.code])}
        </Text>
        <Text
          testID="employee-edit-error-detail"
          className="mt-1 text-center text-sm text-slate-400"
        >
          {error.detail}
        </Text>
      </View>
    );
  }

  if (employee === null) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 p-4">
        <Text className="text-center text-slate-300">{t(($) => $.employees.edit.notFound)}</Text>
      </View>
    );
  }

  return <EmployeeEditForm employee={employee} />;
}

function EmployeeEditForm({ employee }: { employee: Employee }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { values, errors, setField, submit, saving, saveError } = useEmployeeForm({
    kind: 'edit',
    employee,
  });

  const handleSubmit = async () => {
    const success = await submit();
    if (success) {
      router.back();
    }
  };

  return (
    <EmployeeForm
      values={values}
      errors={errors}
      onChangeField={setField}
      onSubmit={() => void handleSubmit()}
      saving={saving}
      saveError={saveError}
      submitLabel={t(($) => $.employees.form.submitEdit)}
    />
  );
}
