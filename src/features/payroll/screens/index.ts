// Payroll screens — thin presentation composed from `../domain` + injected
// repository interfaces via `@/core`. Container: PayrollRunCreateScreen.
// Presentational components live in `./components`. Also re-exports the
// presentation-only `formatEuros` helper (design ADR-4).
export * from './formatEuros';
export * from './PayrollRunCreateScreen';
