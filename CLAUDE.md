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
| Runtime            | **Expo** (managed workflow) + **EAS development build** for preview | Target platform: Android. Expo Go is no longer supported: `react-native-pdf` (receipt viewer) requires the EAS development build. |

### pnpm + Expo/Metro gotcha (read this)

Metro does not resolve pnpm's isolated (symlinked) `node_modules` cleanly, so this project uses a
**hoisted** node-linker. IMPORTANT: pnpm 11 **ignores** `node-linker=hoisted` in `.npmrc` — set
`nodeLinker: hoisted` in `pnpm-workspace.yaml` instead (both files are kept for safety). Verified
empirically on Expo SDK 54 + pnpm 11.5.2: Metro bundles cleanly with the hoisted layout. Also note
pnpm 10+ blocks dependency build (postinstall) scripts by default — run `pnpm approve-builds` when a
dependency legitimately needs its build step (e.g. the Expo lint bootstrap).

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

Routes live in `src/app/` (the Expo Router root — SDK 57's default template location, kept as-is
rather than moved to a repo-root `app/`). Route files are thin wrappers only: a route imports and
renders a screen from `src/features/*/screens`, it never contains business logic itself.

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
- **Every screen with text inputs scrolls through `FormScrollView`** (`src/core`). Android is
  edge-to-edge since Expo SDK 54, so the window no longer shrinks when the keyboard opens; a plain
  `View` leaves the last fields and the submit button behind it. `FormScrollView` wraps
  `react-native-keyboard-controller`'s `KeyboardAwareScrollView` (React Native's
  `KeyboardAvoidingView` mis-sized its padding on device). ESLint blocks importing `ScrollView` or
  `KeyboardAvoidingView` from `react-native`; lists without inputs keep using `FlatList`.

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
- **Identifiers are never real in the repo. Monetary amounts may be.** No real NIF/NIE/NAF/CCC,
  names, or addresses in code, tests, fixtures, or docs — see §6. Monetary figures are a different
  case: a test vector copied from an official TGSS document is what pins the payroll maths to the
  authority that actually charges the cuota, so real amounts ARE permitted in fixtures and tests.
  An amount on its own identifies nobody. Salary figures are still entered in-app per employee.
- All labels, receipt fields, and legal copy on the PDF are in **Spanish**.

## 6. Privacy & data handling (IMPORTANT)

This app stores real personal data: names, **NIF/NIE, NAF (social security number)**, address, salary.

- **Never commit real PII to git.** No real NIF/NIE/NAF/addresses in source, docs, fixtures, or
  commit messages. Use obviously-fake placeholders for **those** values in any committed
  sample/fixture. This rule is about identifiers, not about monetary amounts — see §5.
- The real seed profile (employer + first employee) lives in the user's **local engram memory**
  and, when scaffolded, in a **git-ignored** local seed module + the on-device SQLite DB.
- Personal data stays on-device. No analytics, no telemetry, no third-party upload.

## 7. Commands (once scaffolded)

```bash
pnpm install            # install deps (respect .npmrc)
pnpm start              # start Expo dev server
pnpm start --dev-client # start Metro for the installed EAS development build (no Expo Go)
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
