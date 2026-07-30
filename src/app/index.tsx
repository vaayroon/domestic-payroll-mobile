import { SmokeScreen } from '@/features/employees/screens';

// Thin expo-router wrapper (CLAUDE.md §3: no logic in route files) — renders
// the Foundation slice's acceptance-proof screen. See `SmokeScreen`'s own
// doc comment for what it proves.
export default function HomeScreen() {
  return <SmokeScreen />;
}
