import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(join(root, file), 'utf8'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('release configuration', () => {
  it('keeps the release-please manifest aligned with package.json', () => {
    const manifest = readJson('.release-please-manifest.json');
    const pkg = readJson('package.json');
    expect(isRecord(manifest)).toBe(true);
    expect(isRecord(pkg)).toBe(true);
    expect((manifest as Record<string, unknown>)['.']).toBe(
      (pkg as Record<string, unknown>).version,
    );
  });

  it('keeps the version out of app.json so app.config.ts is the only source', () => {
    const app = readJson('app.json');
    expect(isRecord(app) && isRecord(app.expo)).toBe(true);
    expect('version' in ((app as Record<string, unknown>).expo as Record<string, unknown>)).toBe(
      false,
    );
  });

  it('has no machine-specific *-local EAS build profile', () => {
    const eas = readJson('eas.json');
    expect(isRecord(eas) && isRecord(eas.build)).toBe(true);
    const profiles = Object.keys((eas as { build: Record<string, unknown> }).build);
    expect(profiles.filter((name) => name.endsWith('-local'))).toEqual([]);
  });
});
