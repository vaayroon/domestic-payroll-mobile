/**
 * features/reminder -- the monthly payroll-reminder slice: pure calendar
 * math + preferences codec (`./domain`), the scheduler-orchestration helper
 * (`./application`), and the settings hook + screen (`./hooks`, `./screens`).
 *
 * Dependency direction (CLAUDE.md §3): depends on `@/types` (the
 * `NotificationScheduler` interface) and `@/core` (repository/service
 * interfaces), never on concrete `services/*` implementations.
 */

export * from './domain';
export * from './application';
export * from './hooks';
export * from './screens';
