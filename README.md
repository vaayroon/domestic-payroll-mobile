# Homeslip

A **local-first Android app** for managing payrolls of household employees under the Spanish
**Special Regime for Household Employees** (_Régimen Especial de Empleados de Hogar_).

> **Unofficial app.** Homeslip is unofficial and not affiliated with the Seguridad Social or the
> TGSS. Always check results against the official sources.

## What it is, and what it is not

- It **is** a private employer's tool: compute the monthly net salary, produce the receipt PDF and
  send it to the employee.
- It is **not** an official filing tool. It does not talk to the Seguridad Social, does not submit
  contributions and does not replace professional advice.

## Features

- **Employee management** — multi-employee data model from day one.
- **Payroll calculator** — net salary, pro-rata for partial months (exact days worked), and the
  June/December extra payments (_pagas extra_), all as pure, unit-testable functions.
- **Official receipt** — generates a Spanish _"Recibo Individual de Salarios"_ as a PDF.
- **Dispatch** — sends the receipt via the native mail composer / share sheet.
- **Reminders** — schedules a monthly local notification to run payroll.

## Tech stack

| Concern                    | Choice                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| Framework                  | React Native + **Expo** (managed workflow)                          |
| Language                   | **TypeScript** (strict mode, no `any`)                              |
| Styling                    | **NativeWind v4** (Tailwind CSS for React Native)                   |
| Persistence                | **expo-sqlite** (offline-first)                                     |
| PDF / mail / notifications | expo-print · expo-mail-composer / expo-sharing · expo-notifications |
| Package manager            | **pnpm** (only) · Node **v24.14.1** via `fnm`                       |

## Architecture

Feature-based layered architecture:

```
src/
├── core/        # Shared UI primitives, hooks, global state, theme
├── features/
│   ├── payroll/   # Payroll domain: pure calculation logic + screens
│   └── employees/ # Employee management: state + domain logic + screens
├── services/    # Infrastructure adapters behind interfaces (db, pdf, mail, notify)
└── types/       # Strict shared type declarations
```

Features and core depend on **service abstractions**, never concrete implementations. Payroll
calculations are **pure functions** — no I/O, no system-clock reads inside them. Money is handled
as integer cents (never floats), rounded only at the presentation/PDF boundary.

## Getting started

Requires [`fnm`](https://github.com/Schniz/fnm) with Node **v24.14.1** and
[`pnpm`](https://pnpm.io/). This project uses **pnpm only** — do not use `npm` or `yarn`.

```bash
pnpm install              # install dependencies
pnpm start --dev-client   # start Metro for the installed development build
```

Other scripts:

```bash
pnpm exec tsc --noEmit   # typecheck (strict)
pnpm lint                # lint
pnpm test                # unit tests (payroll math has priority coverage)
```

Branding assets are generated from `branding/` (`pnpm brand:export`, `pnpm brand:check`). See
[CLAUDE.md](CLAUDE.md) for the full engineering contract.

## Install

Homeslip is distributed as a signed APK on
[GitHub Releases](https://github.com/vaayroon/domestic-payroll-mobile/releases). It targets
**arm64-v8a** devices only (virtually all phones since 2017); x86 and 32-bit ARM devices are not
supported.

### Obtainium (recommended, updates automatically)

1. Install [Obtainium](https://obtainium.imranr.dev/).
2. Add an app with the source URL `https://github.com/vaayroon/domestic-payroll-mobile`.
3. Set the APK filter (regular expression) to `arm64-v8a\.apk$`.
4. Install. Obtainium detects new versions from GitHub Releases and offers the update.

### Manual download

1. Download `homeslip-<version>-arm64-v8a.apk` and `SHA256SUMS` from the latest release.
2. Check the checksum: `sha256sum -c SHA256SUMS`.
3. Optional: verify the build provenance with the GitHub CLI:
   `gh attestation verify homeslip-<version>-arm64-v8a.apk --repo vaayroon/domestic-payroll-mobile`.
4. Open the APK on the device and allow installs from the source you used.

Maintainers: see [docs/releasing.md](docs/releasing.md).

## Privacy

Homeslip works fully offline: no network access is required, there is no telemetry and no
analytics, and all data stays on the device. The app stores personal data (names, NIF/NIE, NAF,
address, salary) that **never** leaves the device and is **never committed to this repository**.

## Screenshots policy

Any screenshot in this repository or in the store listing uses fake data only. Real identifiers,
names and addresses are never shown.

## License

Copyright (C) 2026 vaayroon

This program is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY. See
[LICENSE](LICENSE) for the full text.
