/**
 * core/ — shared UI primitives, hooks, and global state/context used across
 * features.
 *
 * Dependency direction (CLAUDE.md §3): `core/` may depend on `types/` and on
 * repository *interfaces*, never on concrete `services/*` implementations —
 * see `RepositoryProvider.tsx`'s doc comment for how that's enforced here.
 */

export * from './RepositoryProvider';
export * from './CurrentEmployerProvider';
export * from './PdfServiceProvider';
export * from './MailServiceProvider';
export * from './NotifyServiceProvider';
export * from './ReminderProvider';
export * from './parseEuroInput';
export * from './validateNifNie';
export * from './validateNaf';
