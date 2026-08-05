/**
 * Preferences codec for the monthly payroll reminder (design D4). Pure --
 * no clock, no I/O -- persisted as a single JSON blob under
 * `SettingsRepository` key `REMINDER_PREFERENCES_KEY` (decision: reuse the
 * existing key/value settings table, no new Drizzle migration).
 *
 * Default is OPT-IN (`enabled: false`): a fresh install never schedules a
 * surprise notification until the user explicitly turns the reminder on.
 */

export interface ReminderPreferences {
  readonly enabled: boolean;
  readonly dayOfMonth: number;
  readonly hour: number;
  readonly minute: number;
}

export const REMINDER_PREFERENCES_KEY = 'reminder.preferences';

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  enabled: false,
  dayOfMonth: 1,
  hour: 9,
  minute: 0,
};

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Structural validation shared by both parse (lenient, falls back to default) and serialize (strict, throws). */
function isValidReminderPreferences(value: unknown): value is ReminderPreferences {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.enabled === 'boolean' &&
    isIntegerInRange(candidate.dayOfMonth, 1, 31) &&
    isIntegerInRange(candidate.hour, 0, 23) &&
    isIntegerInRange(candidate.minute, 0, 59)
  );
}

/**
 * Parses a raw `SettingsRepository.get()` value into validated preferences.
 * Absent (`null`), corrupt JSON, or any out-of-range/wrong-shaped field
 * NEVER throws -- it silently falls back to `DEFAULT_REMINDER_PREFERENCES`
 * (spec RP-2/RP-3).
 */
export function parseReminderPreferences(raw: string | null): ReminderPreferences {
  if (raw === null) {
    return DEFAULT_REMINDER_PREFERENCES;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_REMINDER_PREFERENCES;
  }

  return isValidReminderPreferences(parsed) ? parsed : DEFAULT_REMINDER_PREFERENCES;
}

/**
 * Serializes preferences for `SettingsRepository.set()`. Unlike `parse`,
 * this is STRICT: an out-of-range value (e.g. `dayOfMonth: 32`) throws
 * rather than silently coercing, so an invalid save never reaches
 * persistence (spec RP-4) -- the caller (the settings save hook) is
 * expected to validate form input before calling this.
 */
export function serializeReminderPreferences(preferences: ReminderPreferences): string {
  if (!isValidReminderPreferences(preferences)) {
    throw new RangeError('Invalid ReminderPreferences: fields out of range.');
  }
  return JSON.stringify(preferences);
}
