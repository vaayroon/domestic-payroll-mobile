import { PayrollRunCreateScreen } from '@/features/payroll/screens';

// Thin expo-router wrapper (CLAUDE.md §3: no logic in route files).
export default function NewPayrollRunRoute() {
  return <PayrollRunCreateScreen />;
}
