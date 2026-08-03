/**
 * features/employees — employee management: state + domain logic + screens.
 *
 * Dependency direction (CLAUDE.md §3): depends on `core/` and `types/`
 * (repository interfaces), never on concrete `services/*` implementations.
 */

export * from './domain';
export * from './screens';
