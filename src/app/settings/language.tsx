import { LanguageSettingsScreen } from '@/features/language/screens';

// Thin expo-router wrapper (CLAUDE.md §3: no logic in route files).
export default function LanguageSettingsRoute() {
  return <LanguageSettingsScreen />;
}
