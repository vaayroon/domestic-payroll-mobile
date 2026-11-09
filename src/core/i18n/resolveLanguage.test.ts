import { resolveLanguage } from './resolveLanguage';

const loc = (...codes: (string | null)[]) => codes.map((languageCode) => ({ languageCode }));

describe('resolveLanguage', () => {
  it.each([
    ['en-GB device, no override', null, loc('en'), 'en'],
    ['fr-FR device, no override', null, loc('fr'), 'es'],
    ['override es beats device en', 'es', loc('en'), 'es'],
    ['override en beats device es', 'en', loc('es'), 'en'],
    ['first supported locale in OS order', null, loc('fr', 'en', 'es'), 'en'],
    ['null language codes are skipped', null, loc(null, 'en'), 'en'],
    ['uppercase code is accepted', null, loc('EN'), 'en'],
    ['garbage codes fall back to es', null, loc('xx', ''), 'es'],
    ['no locales falls back to es', null, [], 'es'],
  ] as const)('%s', (_name, pref, locales, expected) => {
    expect(resolveLanguage(pref, locales)).toBe(expected);
  });
});
