/**
 * In-memory `SettingsRepository` fake for unit tests. Real `expo-sqlite`
 * cannot run under `jest-expo` headless, so hooks are exercised against this
 * fake through `RepositoryProvider` instead. Mirrors the private fake
 * duplicated per-test-file elsewhere (e.g. `useReminderSettings.test.tsx`) --
 * this shared copy is new to this slice; existing duplicates are left as-is
 * (out of scope, unrelated churn).
 */

import type { AppSetting, SettingsRepository } from '@/types';

export class InMemorySettingsRepository implements SettingsRepository {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<AppSetting> {
    this.store.set(key, value);
    return { key, value };
  }
}
