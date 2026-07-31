import { resolvePendingMigrations, targetUserVersion } from './migrationPlan';
import type { MigrationJournalEntry } from './migrationPlan';

/**
 * Fixture shaped exactly like `drizzle-kit generate`'s `meta/_journal.json`
 * `entries` array (see `migrations/meta/_journal.json`): each entry's `idx`
 * is the migration's 0-based sequence number, which doubles as the SQLite
 * `PRAGMA user_version` value reached once that migration has been applied.
 */
const journal: MigrationJournalEntry[] = [
  { idx: 0, when: 1, tag: '0000_initial', breakpoints: true },
  { idx: 1, when: 2, tag: '0001_add_settings', breakpoints: true },
  { idx: 2, when: 3, tag: '0002_add_indexes', breakpoints: true },
];

describe('resolvePendingMigrations', () => {
  it('returns every migration on a fresh database (user_version 0)', () => {
    expect(resolvePendingMigrations(0, journal)).toEqual(journal);
  });

  it('returns only migrations at or after the current user_version', () => {
    expect(resolvePendingMigrations(1, journal)).toEqual([journal[1], journal[2]]);
  });

  it('returns an empty array once every migration has already applied', () => {
    expect(resolvePendingMigrations(3, journal)).toEqual([]);
  });

  it('returns nothing beyond the latest migration even if user_version overshoots', () => {
    expect(resolvePendingMigrations(99, journal)).toEqual([]);
  });

  it('returns entries sorted ascending by idx regardless of input order', () => {
    const shuffled = [journal[2], journal[0], journal[1]] as MigrationJournalEntry[];
    expect(resolvePendingMigrations(0, shuffled)).toEqual(journal);
  });

  it('handles an empty journal (no migrations generated yet)', () => {
    expect(resolvePendingMigrations(0, [])).toEqual([]);
  });
});

describe('targetUserVersion', () => {
  it('is the count of migrations in the journal (idx is 0-based and sequential)', () => {
    expect(targetUserVersion(journal)).toBe(3);
  });

  it('is 0 for an empty journal', () => {
    expect(targetUserVersion([])).toBe(0);
  });
});
