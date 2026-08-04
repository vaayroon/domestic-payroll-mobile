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

/** Opens/shares an on-device PDF file via the OS share sheet. */
export interface PdfSharer {
  /** True when the OS share sheet is available (web=false, real Android=true). */
  isAvailable(): Promise<boolean>;
  /** Shares a `file://` PDF uri. `dialogTitle` is the Spanish share-sheet title. */
  share(uri: string, options: { readonly dialogTitle: string }): Promise<void>;
}

/** Outcome of a `MailSender.send` call, matching `expo-mail-composer`'s `MailComposerStatus` values 1:1 as a domain union (never the library's own type). */
export type MailSendResult = 'sent' | 'saved' | 'cancelled' | 'undetermined';

/** Opens the native mail composer with the receipt attached. */
export interface MailSender {
  /** True when a default mail client is configured on the device. */
  isAvailable(): Promise<boolean>;
  send(options: {
    readonly subject: string;
    readonly body: string;
    readonly attachmentUris: readonly string[];
  }): Promise<MailSendResult>;
}
