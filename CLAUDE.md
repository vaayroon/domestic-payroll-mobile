# CLAUDE.md — domestic-payroll-mobile

Project instructions for AI agents working in this repository. Read this before touching code.

## 1. What this project is

A **local-first Android mobile app** to manage payrolls for household employees under the
**Spanish Special Regime for Household Employees** (Régimen Especial de Empleados de Hogar).

Primary user: a private employer who pays one (later: several) household employees and needs to:

- Compute the monthly net salary (with pro-rata for partial months and extra payments).
- Generate an official **"Recibo Individual de Salarios"** as a PDF.
- Send that receipt to the employee (mail composer / native share).
- Get a monthly reminder to run payroll.

The app is **offline-first**: it must be fully usable with no network. All data lives on-device.

## 2. Non-negotiable tooling constraints

| Concern            | Decision                                              | Notes                                              |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------- |
| Package manager    | **pnpm only**                                         | Never `npm` or `yarn`. Never generate lockfiles for them. |
| npx equivalent     | **`pnpm dlx`**                                        | Use `pnpm exec` for locally-installed binaries.    |
| Node version       | **v24.14.1** via `fnm`                                | Pin in `.nvmrc` / `.node-version`.                 |
| UI styling         | **NativeWind v4** (Tailwind CSS for RN)               | Utility classes; no ad-hoc StyleSheet unless justified. |
| Language           | **TypeScript, strict mode**                           | `strict: true`. **No `any`.** Prefer `unknown` + narrowing. |
| Runtime            | **Expo** (managed workflow) + Expo Go for preview     | Target platform: Android.                          |

### pnpm + Expo/Metro gotcha (read this)

Metro historically does not resolve pnpm's isolated (symlinked) `node_modules` cleanly. If Metro
throws module-resolution errors after install, add an `.npmrc` with `node-linker=hoisted` (or a
targeted `public-hoist-pattern`) and reinstall. Verify current guidance via Context7 before
scaffolding — do not hardcode setup steps from memory.

## 3. Architecture — Feature-based Layered

```
src/
├── core/            # Shared: UI primitives, hooks, global state/context, theme
├── features/
│   ├── payroll/     # Payroll domain: pure calculation logic + screens
│   └── employees/   # Employee management: state + domain logic + screens
├── services/        # Infrastructure (isolated behind interfaces):
│   │                #   - db/       SQLite persistence (expo-sqlite)
│   │                #   - pdf/      PDF engine (expo-print)
│   │                #   - mail/     Dispatch (expo-mail-composer / expo-sharing)
│   │                #   - notify/   Local notifications (expo-notifications)
└── types/           # Strict shared type declarations
```

### Layer rules (dependency direction)

- `features/*` and `core/*` depend on **abstractions** of `services/*`, never on concrete impls.
- `services/*` are infrastructure adapters. Swappable. They know nothing about UI.
- **Payroll calculations are PURE FUNCTIONS** — no I/O, no dates read from the system inside them.
  Pass everything in as arguments; return a result. This is what makes them testable.
- `types/` has no runtime code and no dependencies.

## 4. Principles

- **SOLID** applied to hooks and services: single responsibility, depend on interfaces.
- **Offline-first**: every write persists locally (expo-sqlite). No feature may require a network.
- **Clean code**: meaningful names, small pure functions for money math, modular components.
- **Money is never a float in logic.** Represent amounts in integer cents or a Decimal helper;
  round only at the presentation/PDF boundary. Never accumulate rounding errors across a payroll.
- **Data models are multi-employee from day one**, even though we seed a single employee.

## 5. Domain rules (payroll)

Net salary is computed per employee from values stored on-device:

```
Net salary = Gross salary − Employee SS deduction
```

- **Employee SS**: the Régimen Especial de Empleados de Hogar contribution deducted from gross.
- **Pro-rata mode**: for an incomplete first/last month, prorate on **exact days worked**.
  Keep the day-count rule explicit and documented in the payroll module (calendar days).
- **Extra payments (pagas extra)**: two payments of the base gross, paid in **June** and **December**.
  Toggle to include or prorate them.
- **No real amounts in the repo.** Salary figures are entered in-app per employee. Any example
  numbers in code, tests, fixtures, or docs MUST be obviously-fake placeholders.
- All labels, receipt fields, and legal copy on the PDF are in **Spanish**.

## 6. Privacy & data handling (IMPORTANT)

This app stores real personal data: names, **NIF/NIE, NAF (social security number)**, address, salary.

- **Never commit real PII to git.** No real NIF/NIE/NAF/addresses in source, docs, fixtures, or
  commit messages. Use obviously-fake placeholders in any committed sample/fixture.
- The real seed profile (employer + first employee) lives in the user's **local engram memory**
  and, when scaffolded, in a **git-ignored** local seed module + the on-device SQLite DB.
- Personal data stays on-device. No analytics, no telemetry, no third-party upload.

## 7. Commands (once scaffolded)

```bash
pnpm install            # install deps (respect .npmrc)
pnpm start              # start Expo dev server
pnpm android            # open on Android / Expo Go
pnpm exec tsc --noEmit  # typecheck (must pass, strict)
pnpm lint               # lint
pnpm test               # unit tests (payroll math has priority coverage)
```

## 8. Conventions for agents

- Verify library/setup specifics with **Context7** before writing framework config — do not rely on
  training-memory for versioned setup (Expo SDK, NativeWind v4, expo-sqlite API).
- Keep persona/voice out of code artifacts: identifiers, comments, UI copy, and docs are in English
  (UI legal copy in Spanish where the domain requires it). No slang, no emphasis styling in code.
- Prefer pure functions + dependency injection so payroll logic is unit-testable without a device.
- This is an SDD (Spec-Driven Development) project — substantial changes go through the SDD flow.
