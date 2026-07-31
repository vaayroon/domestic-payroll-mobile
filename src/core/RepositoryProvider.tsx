/**
 * DI composition boundary (task 3.8 / CLAUDE.md §3): exposes the persistence
 * layer to `features/*` as repository INTERFACES only. This file imports
 * exclusively from `@/types` — never a concrete `*RepositoryDrizzle` adapter
 * and never `drizzle-orm` — so the "features/core depend on abstractions,
 * never concrete adapters" rule (`sdd/foundation/spec` "Dependency direction
 * enforced") is true by construction, not just convention.
 *
 * The concrete adapters are constructed once, at the composition root
 * (`src/app/_layout.tsx`, which — unlike `core/`/`features/*` — is allowed to
 * import `@/services/db`), and handed to `<RepositoryProvider>` as props.
 */

import { createContext, useContext, type ReactNode } from 'react';

import type { EmployeeRepository, EmployerRepository, PayrollRunRepository, SettingsRepository } from '@/types';

export interface Repositories {
  readonly employers: EmployerRepository;
  readonly employees: EmployeeRepository;
  readonly payrollRuns: PayrollRunRepository;
  readonly settings: SettingsRepository;
}

const RepositoryContext = createContext<Repositories | null>(null);

export function RepositoryProvider({
  repositories,
  children,
}: {
  repositories: Repositories;
  children: ReactNode;
}) {
  return <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>;
}

function useRepositories(): Repositories {
  const repositories = useContext(RepositoryContext);
  if (!repositories) {
    throw new Error('useRepositories (and the useXRepository hooks) must be called within a <RepositoryProvider>.');
  }
  return repositories;
}

export function useEmployerRepository(): EmployerRepository {
  return useRepositories().employers;
}

export function useEmployeeRepository(): EmployeeRepository {
  return useRepositories().employees;
}

export function usePayrollRunRepository(): PayrollRunRepository {
  return useRepositories().payrollRuns;
}

export function useSettingsRepository(): SettingsRepository {
  return useRepositories().settings;
}
