/**
 * Migration runner — the impure half of the migration strategy. Reads the
 * real `PRAGMA user_version`, delegates to the pure `resolvePendingMigrations`
 * (see `migrationPlan.ts`) to decide what still needs to run, executes that
 * SQL inside a transaction, then advances `user_version`.
 *
 * This function requires a live `expo-sqlite` native connection and cannot
 * run under `jest-expo` headless (the native `NativeDatabase` binding is
 * unavailable outside a device/emulator/Expo Go — verified empirically
 * during this batch's apply run). It is therefore NOT covered by an
 * automated test; `migrationPlan.test.ts` covers the decision logic that
 * this function is a thin, verified-by-inspection wrapper around.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import migrations from './migrations/migrations';
import { resolvePendingMigrations, targetUserVersion } from './migrationPlan';

const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

/**
 * Applies every migration the database hasn't seen yet, gated by
 * `PRAGMA user_version` (the locked design decision — see `sdd/foundation/design`
 * §3 — takes precedence over Drizzle's own `__drizzle_migrations` bookkeeping
 * table). Idempotent: re-running against an up-to-date database applies
 * nothing and does not error.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  const { entries } = migrations.journal;

  const pending = resolvePendingMigrations(currentVersion, entries);
  if (pending.length === 0) {
    return;
  }

  await db.withTransactionAsync(async () => {
    for (const entry of pending) {
      const key = `m${entry.idx.toString().padStart(4, '0')}`;
      const sql = migrations.migrations[key];
      if (sql === undefined) {
        throw new Error(`runMigrations: missing SQL for migration "${entry.tag}" (expected key "${key}")`);
      }
      for (const statement of sql.split(STATEMENT_BREAKPOINT)) {
        const trimmed = statement.trim();
        if (trimmed.length > 0) {
          await db.execAsync(trimmed);
        }
      }
    }

    await db.execAsync(`PRAGMA user_version = ${targetUserVersion(entries)}`);
  });
}
