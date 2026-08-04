import { useLocalSearchParams } from 'expo-router';

import { PayrollRunHistoryScreen } from '@/features/payroll/screens';

// Thin expo-router wrapper (CLAUDE.md §3: no logic in route files) — reading
// the `employeeId` param and passing it as a prop is wiring, not business
// logic. Mirrors `employees/[id]/edit.tsx`.
export default function PayrollRunHistoryRoute() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  return <PayrollRunHistoryScreen employeeId={employeeId} />;
}
