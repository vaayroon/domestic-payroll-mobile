// Employer domain state/logic — pure validators + the settings-form hook.
// Depends only on `@/core` (repository interfaces) and `@/types`, never on
// concrete `services/*` implementations (CLAUDE.md §3).

export * from './validateNifNie';
export * from './validateCcc';
export * from './validateEmployerForm';
export * from './useEmployerForm';
