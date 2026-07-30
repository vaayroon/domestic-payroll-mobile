/**
 * core/ — shared UI primitives, hooks, and global state/context (e.g. a future
 * `RepositoryProvider`) used across features.
 *
 * Dependency direction (CLAUDE.md §3): `core/` may depend on `types/` and on
 * repository *interfaces*, never on concrete `services/*` implementations.
 *
 * Empty on purpose for the Foundation slice — populated as later slices add
 * shared primitives.
 */

export {};
