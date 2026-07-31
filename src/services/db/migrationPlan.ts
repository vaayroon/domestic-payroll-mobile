/**
 * Pure migration-decision logic — the part of the migration runner that has
 * NO I/O, so it is fully unit-testable without a device or a live SQLite
 * connection (see `migrationPlan.test.ts`).
 *
 * The impure half (`runMigrations.ts`) reads the real `PRAGMA user_version`,
 * calls `resolvePendingMigrations` with it, executes the returned SQL, then
 * writes the new `PRAGMA user_version` back — per the locked design decision,
 * `user_version` (not Drizzle's own `__drizzle_migrations` bookkeeping table)
 * is the authoritative source of "which migrations have already applied".
 */

/** One entry of drizzle-kit's generated `meta/_journal.json` `entries` array. */
export interface MigrationJournalEntry {
  readonly idx: number;
  readonly when: number;
  readonly tag: string;
  readonly breakpoints: boolean;
}

/**
 * Given the database's current `PRAGMA user_version` and the full migration
 * journal, returns the migrations that still need to apply, ordered ascending
 * by `idx` (their intended application order). A migration's `idx` is its
 * 0-based sequence number, which doubles as the `user_version` value reached
 * once that migration is applied — so "pending" means `idx >= currentVersion`.
 */
export function resolvePendingMigrations(
  currentVersion: number,
  journal: readonly MigrationJournalEntry[],
): MigrationJournalEntry[] {
  return journal.filter((entry) => entry.idx >= currentVersion).sort((a, b) => a.idx - b.idx);
}

/**
 * The `PRAGMA user_version` value the database should be at once every
 * migration in the journal has applied — one past the highest `idx` (or `0`
 * for an empty journal, meaning "no migrations, nothing to do").
 */
export function targetUserVersion(journal: readonly MigrationJournalEntry[]): number {
  return journal.reduce((max, entry) => Math.max(max, entry.idx + 1), 0);
}
