/**
 * Container screen: owns `useEmployeeForm({kind:'create'})` + navigation,
 * renders the presentational `EmployeeForm`.
 */

import { useRouter } from 'expo-router';

import { useEmployeeForm } from '../domain';
import { EmployeeForm } from './components/EmployeeForm';

export function EmployeeCreateScreen() {
  const router = useRouter();
  const { values, errors, setField, submit, saving, saveError } = useEmployeeForm({ kind: 'create' });

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
      submitLabel="Guardar"
    />
  );
}
