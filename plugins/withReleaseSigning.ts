import { withAppBuildGradle, type ConfigPlugin } from 'expo/config-plugins';

import { appendReleaseSigning } from './releaseSigning';

/**
 * Signs the Android release build with a keystore supplied through environment
 * variables, so the generated (git-ignored) android/ project never needs the
 * debug keystore for releases.
 */
export const withReleaseSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning supports only Groovy app/build.gradle files.');
    }
    mod.modResults.contents = appendReleaseSigning(mod.modResults.contents);
    return mod;
  });
