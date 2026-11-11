import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const metadataRoot = join(__dirname, '..', 'fastlane', 'metadata', 'android');

const locales = ['en-US', 'es-ES'] as const;
type Locale = (typeof locales)[number];

const disclaimer: Record<Locale, RegExp> = {
  'en-US': /unofficial.*not affiliated with (the )?Seguridad Social/is,
  'es-ES': /no oficial.*no está afiliada? (a|con) la Seguridad Social/is,
};

const privacy: Record<Locale, RegExp> = {
  'en-US': /stays on your device/i,
  'es-ES': /permanecen en tu dispositivo/i,
};

function read(locale: Locale, file: string): string {
  return readFileSync(join(metadataRoot, locale, file), 'utf8');
}

describe.each(locales)('fastlane metadata (%s)', (locale) => {
  const files = ['title.txt', 'short_description.txt', 'full_description.txt'];

  it.each(files)('has a non-empty %s with a single trailing newline', (file) => {
    const text = read(locale, file);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('respects the Google Play length limits', () => {
    expect(read(locale, 'title.txt').trim().length).toBeLessThanOrEqual(30);
    expect(read(locale, 'short_description.txt').trim().length).toBeLessThanOrEqual(80);
    expect(read(locale, 'full_description.txt').trim().length).toBeLessThanOrEqual(4000);
  });

  it('titles the app Homeslip', () => {
    expect(read(locale, 'title.txt').trim()).toBe('Homeslip');
  });

  it('states the non-affiliation disclaimer and the privacy statement', () => {
    const full = read(locale, 'full_description.txt');
    expect(full).toMatch(disclaimer[locale]);
    expect(full).toMatch(privacy[locale]);
  });
});

it('ships the fallback icon in en-US', () => {
  expect(existsSync(join(metadataRoot, 'en-US', 'images', 'icon.png'))).toBe(true);
});
