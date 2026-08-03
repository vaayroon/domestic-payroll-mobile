import { useLocalSearchParams } from 'expo-router';

import { EmployeeEditScreen } from '@/features/employees/screens';

// Thin expo-router wrapper (CLAUDE.md §3: no logic in route files) — reading
// the `id` param and passing it as a prop is wiring, not business logic.
export default function EditEmployeeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EmployeeEditScreen employeeId={id} />;
}
