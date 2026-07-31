/**
 * services/db — persistence, via Drizzle ORM (expo-sqlite driver).
 *
 * This is the ONLY directory allowed to import `drizzle-orm` — enforced by
 * the `no-restricted-imports` ESLint guard in `eslint.config.js`, which
 * re-enables the import specifically for `src/services/db/**`. Everything
 * outside this directory (features/core) depends on the hand-written
 * repository interfaces in `src/types` instead, never on Drizzle types
 * directly (CLAUDE.md §3).
 *
 * This barrel is the module's public surface: it exports the DB
 * client/migration bootstrap and the concrete `*RepositoryDrizzle` adapters.
 * The only intended consumer is `core/RepositoryProvider`, which constructs
 * these adapters once and exposes them to the rest of the app as their
 * interfaces (`EmployerRepository`, `EmployeeRepository`, etc. from
 * `src/types`) — never as these concrete classes.
 */

export { createDatabase, DATABASE_NAME, type AppDatabase } from './client';
export { runMigrations } from './runMigrations';

export { EmployerRepositoryDrizzle } from './EmployerRepositoryDrizzle';
export { EmployeeRepositoryDrizzle } from './EmployeeRepositoryDrizzle';
export { PayrollRunRepositoryDrizzle } from './PayrollRunRepositoryDrizzle';
export { SettingsRepositoryDrizzle } from './SettingsRepositoryDrizzle';
