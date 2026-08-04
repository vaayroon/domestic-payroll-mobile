/**
 * Non-persistence service contracts — infrastructure boundaries that are NOT
 * repositories (kept out of `repositories.ts`, which is specifically the
 * persistence boundary; see its doc comment). Concrete adapters implementing
 * these interfaces live in `src/services/*` and are wired in via a `core/`
 * provider, mirroring the sealed-adapter pattern used for Drizzle
 * (CLAUDE.md §3).
 */

/** Renders receipt HTML into an on-device PDF file. */
export interface ReceiptPdfGenerator {
  /** Renders self-contained HTML to an on-device PDF file, returning its URI. */
  generate(html: string): Promise<{ readonly uri: string }>;
}
