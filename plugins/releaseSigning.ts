/**
 * Environment variables read by Gradle (not by the plugin) when a release build
 * is requested. The plugin only injects static text, so no secret ever lands in
 * the generated android/ folder.
 */
export const RELEASE_SIGNING_ENV = {
  keystorePath: 'HOMESLIP_KEYSTORE_PATH',
  keystorePassword: 'HOMESLIP_KEYSTORE_PASSWORD',
  keyAlias: 'HOMESLIP_KEY_ALIAS',
  keyPassword: 'HOMESLIP_KEY_PASSWORD',
} as const;

const MARKER_START = '// @generated begin homeslip-release-signing';
const MARKER_END = '// @generated end homeslip-release-signing';

const BLOCK = `${MARKER_START}
def homeslipSigningEnv = [
    '${RELEASE_SIGNING_ENV.keystorePath}',
    '${RELEASE_SIGNING_ENV.keystorePassword}',
    '${RELEASE_SIGNING_ENV.keyAlias}',
    '${RELEASE_SIGNING_ENV.keyPassword}',
]

android {
    signingConfigs {
        release {
            def keystorePath = System.getenv('${RELEASE_SIGNING_ENV.keystorePath}')
            if (keystorePath) {
                storeFile file(keystorePath)
            }
            storePassword System.getenv('${RELEASE_SIGNING_ENV.keystorePassword}')
            keyAlias System.getenv('${RELEASE_SIGNING_ENV.keyAlias}')
            keyPassword System.getenv('${RELEASE_SIGNING_ENV.keyPassword}')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}

// Fail closed: a release build never falls back to the debug keystore.
// EAS builds (EAS_BUILD is set) manage their own signing credentials.
gradle.taskGraph.whenReady { graph ->
    if (!System.getenv('EAS_BUILD') && graph.allTasks.any { it.name.contains('Release') }) {
        def missing = homeslipSigningEnv.findAll { !System.getenv(it) }
        if (!missing.isEmpty()) {
            throw new GradleException(
                "Release signing is not configured. Missing environment variables: \${missing.join(', ')}"
            )
        }
    }
}
${MARKER_END}
`;

/**
 * Appends the release signing block to the generated app/build.gradle.
 * Idempotent: a second call returns the input unchanged.
 */
export function appendReleaseSigning(gradle: string): string {
  if (gradle.includes(MARKER_START)) {
    return gradle;
  }
  const separator = gradle.endsWith('\n') ? '\n' : '\n\n';
  return `${gradle}${separator}${BLOCK}`;
}
