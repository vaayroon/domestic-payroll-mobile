import { RELEASE_SIGNING_ENV, appendReleaseSigning } from './releaseSigning';

const TEMPLATE_GRADLE = `apply plugin: "com.android.application"

android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;

const MARKER_START = '// @generated begin homeslip-release-signing';
const MARKER_END = '// @generated end homeslip-release-signing';

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('appendReleaseSigning', () => {
  it('keeps the original gradle content and appends one marker block', () => {
    const result = appendReleaseSigning(TEMPLATE_GRADLE);
    expect(result.startsWith(TEMPLATE_GRADLE)).toBe(true);
    expect(countOccurrences(result, MARKER_START)).toBe(1);
    expect(countOccurrences(result, MARKER_END)).toBe(1);
  });

  it('is idempotent', () => {
    const once = appendReleaseSigning(TEMPLATE_GRADLE);
    const twice = appendReleaseSigning(once);
    expect(twice).toBe(once);
    expect(countOccurrences(twice, MARKER_START)).toBe(1);
  });

  it('exposes the four HOMESLIP_* environment variable names', () => {
    expect(RELEASE_SIGNING_ENV).toEqual({
      keystorePath: 'HOMESLIP_KEYSTORE_PATH',
      keystorePassword: 'HOMESLIP_KEYSTORE_PASSWORD',
      keyAlias: 'HOMESLIP_KEY_ALIAS',
      keyPassword: 'HOMESLIP_KEY_PASSWORD',
    });
  });

  it('reads every value from the environment at Gradle time and embeds no literal', () => {
    const block = appendReleaseSigning(TEMPLATE_GRADLE).slice(TEMPLATE_GRADLE.length);
    for (const name of Object.values(RELEASE_SIGNING_ENV)) {
      expect(block).toContain(`System.getenv('${name}')`);
    }
    expect(block).not.toMatch(/(storePassword|keyPassword|keyAlias)\s+['"]/);
  });

  it('fails closed for release tasks and names only the variables', () => {
    const block = appendReleaseSigning(TEMPLATE_GRADLE);
    expect(block).toContain('gradle.taskGraph.whenReady');
    expect(block).toContain('GradleException');
    expect(block).toContain('Release');
    for (const name of Object.values(RELEASE_SIGNING_ENV)) {
      expect(block).toContain(name);
    }
  });

  it('binds the release build type to signingConfigs.release and never to debug', () => {
    const block = appendReleaseSigning(TEMPLATE_GRADLE).slice(TEMPLATE_GRADLE.length);
    expect(block).toMatch(/release\s*\{[^}]*signingConfig signingConfigs\.release/);
    expect(block).not.toContain('signingConfigs.debug');
  });
});
