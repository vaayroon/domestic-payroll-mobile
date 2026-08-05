/**
 * Container screen: owns `usePayrollRunForm` + navigation, renders the
 * presentational `PayrollRunForm`. Mirrors `EmployeeCreateScreen.tsx`.
 */

import { useRouter } from 'expo-router';

import { usePayrollRunForm } from '../domain';
import { PayrollRunForm } from './components/PayrollRunForm';

export function PayrollRunCreateScreen() {
  const router = useRouter();
  const {
    employees,
    employeesLoading,
    selectedEmployeeId,
    selectEmployee,
    periodYear,
    periodMonth,
    incrementMonth,
    decrementMonth,
    extraPayMode,
    setExtraPayMode,
    periodStartDate,
    setPeriodStartDate,
    periodEndDate,
    setPeriodEndDate,
    rangeError,
    preview,
    ratesWarning,
    saving,
    error,
    submit,
  } = usePayrollRunForm();

  const handleSubmit = async () => {
    const success = await submit();
    if (success) {
      router.back();
    }
  };

  return (
    <PayrollRunForm
      employees={employees}
      employeesLoading={employeesLoading}
      selectedEmployeeId={selectedEmployeeId}
      onSelectEmployee={selectEmployee}
      periodYear={periodYear}
      periodMonth={periodMonth}
      onIncrementMonth={incrementMonth}
      onDecrementMonth={decrementMonth}
      extraPayMode={extraPayMode}
      onChangeExtraPayMode={setExtraPayMode}
      periodStartDate={periodStartDate}
      onChangePeriodStartDate={setPeriodStartDate}
      periodEndDate={periodEndDate}
      onChangePeriodEndDate={setPeriodEndDate}
      rangeError={rangeError}
      preview={preview}
      ratesWarning={ratesWarning}
      saving={saving}
      error={error}
      onSubmit={() => void handleSubmit()}
    />
  );
}
