// Employees domain state/logic — pure functions + hooks consumed by the
// screens in `../screens`. Depends only on `@/core` (repository interfaces)
// and `@/types`, never on concrete `services/*` implementations
// (CLAUDE.md §3).

export * from './parseEuroInput';
export * from './validateEmployeeForm';
export * from './currentEmployer';
export * from './useEmployees';
export * from './useEmployee';
export * from './useEmployeeForm';
