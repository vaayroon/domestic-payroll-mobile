/**
 * Drizzle client factory — wraps an already-open `expo-sqlite` connection
 * (opened by `SQLiteProvider` at the app root, see `src/app/_layout.tsx`) in a
 * typed Drizzle instance bound to `./schema`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

/** The Drizzle instance type used throughout `services/db/*RepositoryDrizzle.ts`. */
export type AppDatabase = ReturnType<typeof createDatabase>;

/** Wraps an open `expo-sqlite` connection in a Drizzle client bound to our schema. */
export function createDatabase(connection: SQLiteDatabase) {
  return drizzle(connection, { schema });
}

/** The on-device database file name, shared by `SQLiteProvider` and `runMigrations`. */
export const DATABASE_NAME = 'domestic-payroll.db';
