const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const MAX_MINOR_OR_PATCH = 99;

/**
 * Android versionCode from a plain `major.minor.patch` version:
 * `major * 10000 + minor * 100 + patch`.
 *
 * Pre-release and build suffixes are rejected, and minor/patch must be <= 99 so
 * the result stays strictly increasing across releases.
 */
export function versionCodeFromSemver(version: string): number {
  const match = SEMVER.exec(version);
  if (match === null) {
    throw new Error(`Invalid version "${version}": expected plain major.minor.patch.`);
  }
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
  if (minor > MAX_MINOR_OR_PATCH || patch > MAX_MINOR_OR_PATCH) {
    throw new Error(
      `Invalid version "${version}": minor and patch must be <= ${MAX_MINOR_OR_PATCH} to keep versionCode monotonic.`,
    );
  }
  return major * 10000 + minor * 100 + patch;
}
