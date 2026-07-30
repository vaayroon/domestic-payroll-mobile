/**
 * Concrete `SettingsRepository` adapter — backs the Foundation smoke screen's
 * DB round-trip proof (write a key, read it back). Never imported outside
 * `services/db/`; wired in through `core/RepositoryProvider`.
 */

import { eq } from 'drizzle-orm';

import type { AppSetting, SettingsRepository } from '@/types';

import type { AppDatabase } from './client';
import { appSettingRowToDomain } from './mappers';
import { appSettings } from './schema';

export class SettingsRepositoryDrizzle implements SettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.select().from(appSettings).where(eq(appSettings.key, key)).get();
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<AppSetting> {
    const [row] = await this.db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } })
      .returning();
    if (!row) {
      throw new Error(`SettingsRepositoryDrizzle.set: upsert returned no row for key "${key}"`);
    }
    return appSettingRowToDomain(row);
  }
}
