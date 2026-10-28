// Payroll screens — thin presentation composed from `../domain` + injected
// repository interfaces via `@/core`. Containers: PayrollRunCreateScreen,
// PayrollRunHistoryScreen, ReceiptViewerScreen.
// Presentational components live in `./components`. Also re-exports the
// presentation-only `formatEuros` helper (design ADR-4).
export * from './formatEuros';
export * from './PayrollRunCreateScreen';
export * from './PayrollRunHistoryScreen';
export * from './ReceiptViewerScreen';
