/**
 * Employer bootstrap + current-employer resolution (design ADR-2).
 *
 * Lives in `core/` (not a feature) because it is global state/context shared
 * across features (CLAUDE.md §3): both `features/employees` and
 * `features/payroll` need the current employer id, so this cannot be owned
 * by either feature without recreating the cross-feature coupling this
 * refactor removes.
 *
 * Mounted once at the composition root (`src/app/_layout.tsx`), between
 * `<RepositoryProvider>` and `<Stack>`. On mount, idempotently ensures
 * exactly one `Employer` row exists (`EmployerRepository.list()[0] ??
 * create(BOOTSTRAP_EMPLOYER)`), then exposes its id via
 * `useCurrentEmployerId()` — a single source of truth so screens/hooks never
 * repeat the `list()` call themselves.
 *
 * The placeholder employer created on first launch is intentionally neutral
 * and non-PII (CLAUDE.md §6); a future employer-settings slice makes it
 * editable.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { NewEmployer } from '@/types';

import { useTranslation } from './i18n';
import { useEmployerRepository } from './RepositoryProvider';

const BOOTSTRAP_EMPLOYER: NewEmployer = { name: 'Empleador' };

const CurrentEmployerContext = createContext<string | null>(null);

type BootstrapState = { status: 'loading' } | { status: 'ready'; employerId: string } | { status: 'error' };

export function CurrentEmployerProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const employerRepository = useEmployerRepository();
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const existing = await employerRepository.list();
        const employer = existing[0] ?? (await employerRepository.create(BOOTSTRAP_EMPLOYER));
        if (cancelled) {
          return;
        }
        setState({ status: 'ready', employerId: employer.id });
      } catch {
        if (cancelled) {
          return;
        }
        setState({ status: 'error' });
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [employerRepository]);

  if (state.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-slate-300">{t(($) => $.app.startup.loading)}</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 p-4">
        <Text className="text-center text-red-400">{t(($) => $.app.startup.error)}</Text>
      </View>
    );
  }

  return <CurrentEmployerContext.Provider value={state.employerId}>{children}</CurrentEmployerContext.Provider>;
}

export function useCurrentEmployerId(): string {
  const employerId = useContext(CurrentEmployerContext);
  if (employerId === null) {
    throw new Error('useCurrentEmployerId must be called within a <CurrentEmployerProvider>.');
  }
  return employerId;
}
