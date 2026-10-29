/**
 * Non-persistence service contracts — infrastructure boundaries that are NOT
 * repositories (kept out of `repositories.ts`, which is specifically the
 * persistence boundary; see its doc comment). Concrete adapters implementing
 * these interfaces live in `src/services/*` and are wired in via a `core/`
 * provider, mirroring the sealed-adapter pattern used for Drizzle
 * (CLAUDE.md §3).
 *
 * This file holds two different contract shapes: behavioural interfaces
 * (the five above) and two PROPS contracts (`SignaturePadProps` and
 * `PdfViewerProps` below) for sealed rendering surfaces. See design
 * ADR-1/ADR-2 of `sdd/saved-signature/design` (and ADR-2 of
 * `sdd/in-app-pdf-preview/design`) for why the props-contract deviation is
 * deliberate rather than an accident.
 */

/** Options for `ReceiptPdfGenerator.generate`. */
export interface ReceiptPdfGenerateOptions {
  /**
   * Open (user) password. When present, the file at the returned uri is
   * encrypted, and a plain rendering never survives a resolved OR rejected
   * call: on any failure the plain file is deleted and the call rejects. Must
   * be non-empty. The password is never logged, put in errors or filenames.
   */
  readonly password?: string;
}

/** Renders receipt HTML into an on-device PDF file. */
export interface ReceiptPdfGenerator {
  /**
   * Renders self-contained HTML to an on-device PDF file, returning its URI.
   * Pass `options.password` to get a password-protected file instead.
   */
  generate(html: string, options?: ReceiptPdfGenerateOptions): Promise<{ readonly uri: string }>;
  /**
   * Best-effort delete of a file previously returned by `generate`. Never
   * throws; a no-op for anything outside the app cache.
   */
  discard(uri: string): Promise<void>;
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

/** Mirrors `expo-notifications`' own permission status values 1:1 as a domain union (never the library's own type), design ADR D1. */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Schedules/cancels the single monthly payroll-reminder local notification.
 * One cohesive interface rather than split permission/channel/schedule
 * interfaces (design D1): the only consumer, `reconcileReminder`, always
 * needs every method together, and there is exactly one adapter (unlike
 * `PdfSharer`/`MailSender`, which are genuinely different OS subsystems).
 * `scheduleReminder` always cancels-then-schedules under a FIXED,
 * well-known identifier, so rescheduling is idempotent without persisting or
 * querying any id.
 */
export interface NotificationScheduler {
  /** Reads the current permission state without prompting the user. */
  getPermissionStatus(): Promise<NotificationPermissionStatus>;
  /** Prompts the OS permission dialog (Android 13+ `POST_NOTIFICATIONS`). */
  requestPermission(): Promise<NotificationPermissionStatus>;
  /** Idempotently ensures the Android notification channel exists. */
  ensureChannel(): Promise<void>;
  /** Cancels any existing reminder, then schedules a new one for `fireDate`. Returns the notification identifier. */
  scheduleReminder(fireDate: Date): Promise<string>;
  /** Cancels the reminder if one is scheduled; a no-op otherwise. */
  cancelReminder(): Promise<void>;
  /**
   * Resolves `true` exactly once if the app was woken/cold-started by a
   * default-action tap on the reminder, consuming it so a later call never
   * reports the same tap again (spec TN-3, device-QA-verified). Deliberately
   * a plain async method rather than wrapping `expo-notifications`'
   * `useLastNotificationResponse` REACT HOOK, so this whole interface stays
   * hook-free, plain-async, and fakeable in unit tests.
   */
  consumeStartupTap(): Promise<boolean>;
  /** Registers a listener for default-action taps received while the app is already running (foreground/background, spec TN-1). Returns an unsubscribe function. */
  onTap(listener: () => void): () => void;
}

export type SignaturePadFailureCode = 'load_failed' | 'capture_failed';

/**
 * Imperative handle a `SignaturePad` hands back once its drawing surface is
 * ready. Plain data + functions -- deliberately NOT a React ref, so the
 * contract stays free of React types and `src/types` keeps its zero-dependency
 * property (CLAUDE.md §3).
 */
export interface SignaturePadControls {
  /** Exports the current drawing. Answers via `onCapture`, or `onEmpty` when nothing was drawn. */
  readonly capture: () => void;
  /** Clears the drawing surface only. Never touches persistence. */
  readonly clear: () => void;
}

/**
 * Props contract for the sealed signature-capture surface
 * (`src/services/signature/SignaturePadView`). Domain-free: no payroll, no
 * employer, no persistence. The ONLY contract in this file that is a props
 * shape rather than a behavioural interface -- see ADR-1 of
 * `sdd/saved-signature/design` for why that deviation is deliberate.
 */
export interface SignaturePadProps {
  /** Bare base64 PNG (NO `data:` prefix) to pre-draw, enabling edit-in-place. `null` starts blank. */
  readonly initialPngBase64: string | null;
  /** Explicit pixel height. A WebView with no height collapses to zero on Android. */
  readonly heightPx: number;
  readonly penColor: string;
  readonly onReady: (controls: SignaturePadControls) => void;
  /** Bare base64 PNG payload, `data:` prefix already stripped by the adapter. */
  readonly onCapture: (pngBase64: string) => void;
  readonly onEmpty: () => void;
  /** A CODE, never a message -- the library's raw error text must never reach the app (see design ADR-6). */
  readonly onFailure: (code: SignaturePadFailureCode) => void;
  readonly testID?: string;
}

export type PdfViewerFailureCode = 'load_failed';

/**
 * Props contract for the sealed PDF surface (`src/services/pdfviewer`).
 * Domain-free: no payroll, no employee, no library or React types. The
 * adapter always fills its parent (flex: 1); the caller sizes the container.
 */
export interface PdfViewerProps {
  /** Local `file://` PDF uri. Validated by the caller before mounting. */
  readonly uri: string;
  /** Fires once the document is rendered, with its page count. */
  readonly onLoad: (pageCount: number) => void;
  /** A CODE, never the library's error object or message text. */
  readonly onFailure: (code: PdfViewerFailureCode) => void;
  readonly testID?: string;
}
