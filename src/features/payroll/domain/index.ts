// Payroll pure calculation logic (net salary, pro-rata, pagas extra) plus
// the run-form hook that composes it with the repository layer.
// The engine itself has no I/O, no system dates read internally — everything
// is passed in as arguments (CLAUDE.md §3, §5).
export * from './engine';
export * from './usePayrollRunForm';
