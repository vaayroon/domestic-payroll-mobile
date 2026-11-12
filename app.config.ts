import 'tsx/cjs';

import type { ConfigContext, ExpoConfig } from 'expo/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import appJson from './app.json';
import { versionCodeFromSemver } from './plugins/versionCode';

function readPackageVersion(projectRoot: string): string {
  const raw: unknown = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  if (typeof raw !== 'object' || raw === null || !('version' in raw)) {
    throw new Error('package.json must declare a "version".');
  }
  const { version } = raw;
  if (typeof version !== 'string') {
    throw new Error('package.json "version" must be a string.');
  }
  return version;
}

/**
 * Static values live in app.json. The version is derived from package.json (the
 * only place release-please bumps) so the app version and Android versionCode
 * can never drift from the release.
 */
export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const base: ExpoConfig = { ...appJson.expo, ...config } as ExpoConfig;
  if (!base.name || !base.slug) {
    throw new Error('app.json must declare "name" and "slug".');
  }
  const version = readPackageVersion(projectRoot);
  return {
    ...base,
    name: base.name,
    slug: base.slug,
    version,
    android: { ...base.android, versionCode: versionCodeFromSemver(version) },
  };
};
