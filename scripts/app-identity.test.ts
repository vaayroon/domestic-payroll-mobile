import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface AppConfig {
  expo: {
    name: string;
    slug: string;
    scheme: string;
    userInterfaceStyle: string;
    android: { package: string };
  };
}

const appConfig = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as AppConfig;

describe('app identity', () => {
  it('uses the Homeslip display name and slug', () => {
    expect(appConfig.expo.name).toBe('Homeslip');
    expect(appConfig.expo.slug).toBe('homeslip');
  });

  it('uses the Homeslip scheme and application id', () => {
    expect(appConfig.expo.scheme).toBe('homeslip');
    expect(appConfig.expo.android.package).toBe('io.github.vaayroon.homeslip');
  });

  it('commits the dark user interface style', () => {
    expect(appConfig.expo.userInterfaceStyle).toBe('dark');
  });
});
