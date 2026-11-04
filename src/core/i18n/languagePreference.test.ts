import {
  parseLanguagePreference,
  serializeLanguagePreference,
  UI_LANGUAGE_KEY,
} from './languagePreference';
import type { SupportedLanguage } from './resolveLanguage';

describe('languagePreference', () => {
  it('uses the ui.language settings key', () => {
    expect(UI_LANGUAGE_KEY).toBe('ui.language');
  });

  it.each([
    ['es', 'es'],
    ['en', 'en'],
    ['', null],
    [null, null],
    ['xx', null],
    ['EN', null],
    ['auto', null],
  ] as const)('parses %p leniently as %p', (raw, expected) => {
    expect(parseLanguagePreference(raw)).toBe(expected);
  });

  it('serializes strictly', () => {
    expect(serializeLanguagePreference('es')).toBe('es');
    expect(serializeLanguagePreference('en')).toBe('en');
    expect(serializeLanguagePreference(null)).toBe('');
    expect(() => serializeLanguagePreference('xx' as SupportedLanguage)).toThrow(RangeError);
  });
});
