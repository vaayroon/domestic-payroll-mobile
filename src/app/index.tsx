import { EmployeeListScreen } from '@/features/employees/screens';

// Thin expo-router wrapper (CLAUDE.md §3: no logic in route files).
export default function HomeScreen() {
  return <EmployeeListScreen />;
}
