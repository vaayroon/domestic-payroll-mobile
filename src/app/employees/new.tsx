import { EmployeeCreateScreen } from '@/features/employees/screens';

// Thin expo-router wrapper (CLAUDE.md §3: no logic in route files).
export default function NewEmployeeRoute() {
  return <EmployeeCreateScreen />;
}
