import {
  DEFAULT_REMINDER_PREFERENCES,
  parseReminderPreferences,
  serializeReminderPreferences,
  type ReminderPreferences,
} from './preferences';

describe('parseReminderPreferences', () => {
  it('RP-1: round-trips a valid value through serialize/parse', () => {
    const prefs: ReminderPreferences = { enabled: true, dayOfMonth: 15, hour: 20, minute: 30 };

    const result = parseReminderPreferences(serializeReminderPreferences(prefs));

    expect(result).toEqual(prefs);
  });

  it('RP-2: missing key (null) falls back to the default', () => {
    expect(parseReminderPreferences(null)).toEqual(DEFAULT_REMINDER_PREFERENCES);
  });

  it('RP-3: corrupt JSON falls back to the default without throwing', () => {
    expect(() => parseReminderPreferences('{not valid json')).not.toThrow();
    expect(parseReminderPreferences('{not valid json')).toEqual(DEFAULT_REMINDER_PREFERENCES);
  });

  it('RP-4 (read side): a stored out-of-range value falls back to the default', () => {
    expect(parseReminderPreferences('{"enabled":true,"dayOfMonth":32,"hour":9,"minute":0}')).toEqual(
      DEFAULT_REMINDER_PREFERENCES,
    );
    expect(parseReminderPreferences('{"enabled":true,"dayOfMonth":1,"hour":24,"minute":0}')).toEqual(
      DEFAULT_REMINDER_PREFERENCES,
    );
    expect(parseReminderPreferences('{"enabled":true,"dayOfMonth":1,"hour":9,"minute":60}')).toEqual(
      DEFAULT_REMINDER_PREFERENCES,
    );
    expect(parseReminderPreferences('{"enabled":"yes","dayOfMonth":1,"hour":9,"minute":0}')).toEqual(
      DEFAULT_REMINDER_PREFERENCES,
    );
  });
});

describe('serializeReminderPreferences', () => {
  it('RP-4 (write side): rejects an out-of-range value -- nothing is returned to persist', () => {
    expect(() =>
      serializeReminderPreferences({ enabled: true, dayOfMonth: 32, hour: 9, minute: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      serializeReminderPreferences({ enabled: true, dayOfMonth: 1, hour: 24, minute: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      serializeReminderPreferences({ enabled: true, dayOfMonth: 1, hour: 9, minute: 60 }),
    ).toThrow(RangeError);
    expect(() =>
      serializeReminderPreferences({ enabled: true, dayOfMonth: 1.5, hour: 9, minute: 0 }),
    ).toThrow(RangeError);
  });

  it('serializes a valid value as JSON', () => {
    const prefs: ReminderPreferences = { enabled: false, dayOfMonth: 1, hour: 9, minute: 0 };

    expect(serializeReminderPreferences(prefs)).toBe(JSON.stringify(prefs));
  });
});
