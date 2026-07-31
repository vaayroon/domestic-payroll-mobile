import type { Config } from 'drizzle-kit';

/**
 * drizzle-kit config — generation only (`pnpm db:generate`). The `expo`
 * driver tells drizzle-kit to emit migrations without needing a live
 * `dbCredentials` connection string, since the actual SQLite file only
 * exists on-device. Runtime migration application is handled by our own
 * `services/db/runMigrations.ts` (PRAGMA `user_version` gate), NOT by
 * drizzle-kit's `migrate`/`push` commands.
 */
export default {
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/services/db/schema.ts',
  out: './src/services/db/migrations',
} satisfies Config;
