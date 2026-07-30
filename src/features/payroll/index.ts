/**
 * features/payroll — payroll domain: pure calculation logic (net salary,
 * pro-rata on exact days worked, pagas extra) plus the screens that present it
 * (CLAUDE.md §5).
 *
 * Dependency direction (CLAUDE.md §3): depends on `core/` and `types/`
 * (repository interfaces), never on concrete `services/*` implementations.
 * Calculation logic MUST remain pure functions with no I/O.
 *
 * Empty on purpose for the Foundation slice — payroll math is out of scope
 * here (see `sdd/foundation/spec`) and lands in a later slice.
 */

export {};
