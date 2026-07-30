/**
 * types/ — shared, strict type declarations for the domain.
 *
 * No runtime I/O and no dependency on `core/`, `features/*`, or `services/*`
 * (CLAUDE.md §3). The one deliberate exception is `money.ts`: it exports pure,
 * side-effect-free arithmetic helpers alongside the `Cents` type itself, since
 * a branded numeric type is not useful without its safe constructors — see the
 * doc comment at the top of `money.ts` for the full rationale.
 *
 * Repository interfaces (returning domain types, never ORM types) and the
 * `Employee`/`Employer`/`PayrollRun` domain models are added in a later slice.
 */

export * from './money';
