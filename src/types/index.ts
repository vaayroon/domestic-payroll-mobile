/**
 * types/ — shared, strict type declarations for the domain.
 *
 * No runtime I/O and no dependency on `core/`, `features/*`, or `services/*`
 * (CLAUDE.md §3). The one deliberate exception is `money.ts`: it exports pure,
 * side-effect-free arithmetic helpers alongside the `Cents` type itself, since
 * a branded numeric type is not useful without its safe constructors — see the
 * doc comment at the top of `money.ts` for the full rationale.
 *
 * `domain.ts` declares the `Employer`/`Employee`/`PayrollRun`/`AppSetting`
 * models; `repositories.ts` declares the repository interfaces that return
 * them. Both are plain types with zero ORM dependency — the concrete Drizzle
 * adapters implementing these interfaces live in `src/services/db/`.
 */

export * from './domain';
export * from './money';
export * from './repositories';
