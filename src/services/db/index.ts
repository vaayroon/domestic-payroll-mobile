/**
 * services/db — persistence, via Drizzle ORM (expo-sqlite driver).
 *
 * This is the ONLY directory allowed to import `drizzle-orm` — enforced by
 * the `no-restricted-imports` ESLint guard in `eslint.config.js`, which
 * re-enables the import specifically for `src/services/db/**`. Everything
 * outside this directory (features/core) depends on the hand-written
 * repository interfaces in `src/types` instead, never on Drizzle types
 * directly (CLAUDE.md §3).
 *
 * Empty placeholder for the Foundation slice's Phase 2 batch — the schema,
 * migrations, DB client, mappers, and repository adapters are built in the
 * Persistence Layer phase (see `sdd/foundation/tasks`, Phase 3).
 */

export {};
