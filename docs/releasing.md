# Releasing Homeslip

Releases are automated: merging a conventional-commit release PR on `main` builds one signed
**arm64-v8a** APK and attaches it to a GitHub Release. This guide covers the one-time setup and the
operations that need a human.

## Quick path

1. Merge changes to `main` with conventional commits (`feat:`, `fix:`, ...).
2. `release-please` opens or updates a release PR (version, `CHANGELOG.md`, `package.json`).
3. Merge the release PR. The same workflow run creates the tag and Release, then builds the APK.
4. Approve the `release` environment when GitHub asks (required reviewer).
5. Check the Release: `homeslip-<version>-arm64-v8a.apk` and `SHA256SUMS` are attached.

## How it fits together

| Piece                                  | Role                                                             |
| -------------------------------------- | ---------------------------------------------------------------- |
| `.github/workflows/ci.yml`             | Lint, typecheck, tests on pull requests and pushes to `main`     |
| `.github/workflows/release-please.yml` | Release PR, tag, Release; calls the build when a release is made |
| `.github/workflows/build-apk.yml`      | Reusable build: sign, verify, attest, upload (also a dry run)    |
| `app.config.ts`                        | Reads the version from `package.json`, computes `versionCode`    |
| `plugins/withReleaseSigning.ts`        | Adds the release signing config to the generated Gradle project  |

The build runs inside the release-please workflow on purpose: tags created with `GITHUB_TOKEN` do
not trigger other workflows, so a separate tag-triggered build would never run.

## Version and versionCode

The version lives only in `package.json` (release-please bumps it; `app.json` has no `version`).

```
versionCode = major * 10000 + minor * 100 + patch      # 1.0.0 -> 10000, 1.2.3 -> 10203
```

Minor and patch must stay at 99 or below, and pre-release suffixes are rejected. A build fails
rather than produce a `versionCode` that could go backwards.

## One-time setup

### 1. Create the keystore

```bash
keytool -genkeypair -v -keystore homeslip-release.jks -alias <key-alias> \
  -keyalg RSA -keysize 4096 -validity 10000
```

Choose strong passwords and keep the file out of the repository (`*.jks` and `*.keystore` are
git-ignored). Then encode it for GitHub:

```bash
base64 -w0 homeslip-release.jks
```

### 2. Create the `release` environment

In the repository settings, create an environment named `release` with:

- a required reviewer (you);
- deployment branches limited to `main`.

### 3. Add the environment secrets

Add these as secrets of the `release` environment, never as repository secrets:

| Secret                      | Value                              |
| --------------------------- | ---------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | base64 output of the keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password                  |
| `ANDROID_KEY_ALIAS`         | key alias used in `keytool`        |
| `ANDROID_KEY_PASSWORD`      | key password                       |

Optional: set the environment variable `RELEASE_CERT_SHA256` to the certificate fingerprint. When
set, the build fails if the signing certificate differs. Print it with:

```bash
keytool -list -v -keystore homeslip-release.jks -alias <key-alias>
```

The repository must be public for free build attestations and for Obtainium to read releases
without a token.

## Keystore: never rotate, always back up

Android refuses to update an app signed with a different key, so **the same keystore signs every
release and is never rotated**. Losing it means users must uninstall and reinstall.

- Keep at least two offline copies (for example an encrypted drive and a password manager
  attachment), plus the passwords stored separately.
- Restore: place the file anywhere, run `base64 -w0` on it and replace the
  `ANDROID_KEYSTORE_BASE64` secret. Compare the fingerprint with `RELEASE_CERT_SHA256`.

## Dry run

Run the build without publishing anything:

1. Open Actions, then **Build APK**, then **Run workflow**, and pick the branch (default `main`).
2. Approve the `release` environment.
3. Download the `homeslip-apk` artifact (kept 7 days) and check it:

```bash
sha256sum -c SHA256SUMS
apksigner verify --print-certs homeslip-<version>-arm64-v8a.apk
```

A dry run never creates or edits a Release and never creates an attestation. The workflow must
exist on the default branch to be dispatchable.

## First release (1.0.0) cleanup

`release-please-config.json` pins the first version with `release-as: "1.0.0"` and ignores earlier
history with `bootstrap-sha`. After `v1.0.0` ships, remove both keys in a `chore` commit so
later versions follow the commit history again.

## Verify a published release

```bash
sha256sum -c SHA256SUMS
gh attestation verify homeslip-<version>-arm64-v8a.apk --repo vaayroon/domestic-payroll-mobile
```

The certificate SHA-256 printed by `apksigner verify --print-certs` must be identical across
releases.

## Rollback

1. Delete the GitHub Release and its tag (`git push --delete origin v<version>`).
2. Reset `.release-please-manifest.json` to the previous version and revert the version bump in
   `package.json` and `CHANGELOG.md`.
3. Fix forward and release again. If only the build failed, re-run the failed jobs of the
   workflow run: the Release already exists and the APK is uploaded to it by tag.

## Limitations

- **arm64-v8a only.** One APK per release, built with `-PreactNativeArchitectures=arm64-v8a`.
  There is no universal APK and no x86 or 32-bit ARM build. The restriction applies to CI only,
  so x86_64 emulator development builds keep working.
- Distribution is GitHub Releases only; there is no Play Store listing.
