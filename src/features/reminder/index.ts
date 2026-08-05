/**
 * features/reminder -- the monthly payroll-reminder slice: pure calendar
 * math + preferences codec (`./domain`), the scheduler-orchestration helper
 * (`./application`), and the settings hook + screen (added in a later work
 * unit).
 *
 * Dependency direction (CLAUDE.md §3): depends on `@/types` (the
 * `NotificationScheduler` interface) and `@/core` (repository interfaces),
 * never on concrete `services/*` implementations.
 */

export * from './domain';
export * from './application';
