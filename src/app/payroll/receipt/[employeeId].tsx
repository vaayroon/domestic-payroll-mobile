import { useLocalSearchParams } from 'expo-router';

import { ReceiptViewerScreen } from '@/features/payroll/screens';

// Thin expo-router wrapper (CLAUDE.md §3: no logic in route files). The params
// are untrusted (they can arrive from a deep link), so they are passed through
// as-is and validated by the screen's pure parser, never here.
export default function ReceiptViewerRoute() {
  const params = useLocalSearchParams<{
    employeeId: string | string[];
    runId: string | string[];
    uri: string | string[];
    encrypted: string | string[];
  }>();
  return <ReceiptViewerScreen params={params} />;
}
