import migrations from './migrations/migrations';
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

/**
 * Integrity checks against the REAL generated bundle, not a fixture. These
 * guard the two ways a migration can be silently broken: a journal entry whose
 * SQL never made it into the hand-maintained `migrations.js` map (which fails
 * only at app boot, on a user's device), and a regenerated schema that quietly
 * tightens a column the design requires to stay nullable.
 */
describe('generated migration bundle', () => {
  const { entries } = migrations.journal;

  it('has a sequential, 0-based journal', () => {
    expect(entries.map((entry) => entry.idx)).toEqual(entries.map((_entry, index) => index));
  });

  it('has non-empty SQL for every journal entry, under the key runMigrations derives', () => {
    for (const entry of entries) {
      const key = `m${entry.idx.toString().padStart(4, '0')}`;
      expect(typeof migrations.migrations[key]).toBe('string');
      expect(migrations.migrations[key]?.trim()).not.toBe('');
    }
  });

  it('keeps every migration additive: no DROP or table rewrite on an existing install', () => {
    for (const sql of Object.values(migrations.migrations)) {
      expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    }
  });

  it('adds the cotización anchors as nullable columns with no default (design ADR-1)', () => {
    const anchorMigration = Object.values(migrations.migrations).find((sql) =>
      sql.includes('base_cotizacion_cents'),
    );

    expect(anchorMigration).toBeDefined();
    expect(anchorMigration).toContain('ALTER TABLE `payroll_runs` ADD `base_cotizacion_cents` integer');
    expect(anchorMigration).toContain('ALTER TABLE `payroll_runs` ADD `contract_type` text');
    // A default would make every pre-existing row read back as anchored.
    expect(anchorMigration).not.toMatch(/\bNOT\s+NULL\b/i);
    expect(anchorMigration).not.toMatch(/\bDEFAULT\b/i);
  });

  it('adds grupo_cotizacion as a nullable column with no default and no backfill', () => {
    // Located by content, not by migration number, so the test survives renumbering.
    const grupoMigration = Object.values(migrations.migrations).find((sql) => sql.includes('grupo_cotizacion'));

    expect(grupoMigration).toBeDefined();
    expect(grupoMigration).toContain('ALTER TABLE `employees` ADD `grupo_cotizacion` text');
    // null means "not on file"; a default or a backfill would invent a group.
    expect(grupoMigration).not.toMatch(/\bNOT\s+NULL\b/i);
    expect(grupoMigration).not.toMatch(/\bDEFAULT\b/i);
    expect(grupoMigration).not.toMatch(/\bUPDATE\b/i);
  });

  it('adds the receipt encryption columns: a NOT NULL default-false flag and a nullable override, no backfill', () => {
    // Located by content, not by migration number, so the test survives renumbering.
    const receiptMigration = Object.values(migrations.migrations).find((sql) =>
      sql.includes('receipt_password_override'),
    );

    expect(receiptMigration).toBeDefined();
    const statements = (receiptMigration ?? '')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter((statement) => statement !== '');
    const enabled = statements.find((statement) => statement.includes('receipt_encryption_enabled'));
    const override = statements.find((statement) => statement.includes('receipt_password_override'));

    expect(statements).toHaveLength(2);
    expect(enabled).toMatch(/ALTER TABLE `employees` ADD `receipt_encryption_enabled` integer\b/);
    // Existing rows must read back as "off".
    expect(enabled).toMatch(/\bNOT\s+NULL\b/i);
    expect(enabled).toMatch(/\bDEFAULT\s+(false|0)\b/i);
    expect(override).toMatch(/ALTER TABLE `employees` ADD `receipt_password_override` text\b/);
    // null means "derive from the document"; a default would invent a password.
    expect(override).not.toMatch(/\bNOT\s+NULL\b/i);
    expect(override).not.toMatch(/\bDEFAULT\b/i);
    // The NIF must never be copied into the override.
    expect(receiptMigration).not.toMatch(/\bUPDATE\b/i);
  });
});
