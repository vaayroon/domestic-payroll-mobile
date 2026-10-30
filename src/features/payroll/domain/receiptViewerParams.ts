/**
 * Pure parser for the receipt-viewer route params (design ADR-6). Route
 * params are untrusted input -- a deep link can carry anything -- so this
 * guard decides whether the native PDF view may be mounted at all. A bad
 * value never throws: it yields `{ ok: false }` and the screen renders its
 * failure state.
 *
 * No I/O and no React.
 */

export interface RawReceiptViewerParams {
  readonly employeeId?: string | string[];
  readonly runId?: string | string[];
  readonly uri?: string | string[];
  /** Non-secret flag: the file is password-protected. The password itself is never a route param. */
  readonly encrypted?: string | string[];
}

export type ReceiptViewerParams =
  | {
      readonly ok: true;
      readonly employeeId: string;
      readonly runId: string;
      readonly uri: string;
      /** `true` only for the exact value `'1'`; anything else reads as a plain file. */
      readonly encrypted: boolean;
    }
  | { readonly ok: false };

/** `file:///` (empty host) + a path with no query/hash + `.pdf` (case-insensitive). */
const RECEIPT_PDF_URI = /^file:\/\/\/[^?#]+\.pdf$/i;

/** The Android app cache directory segment, where expo-print writes `Print/<name>.pdf`. */
const APP_CACHE_SEGMENT = 'cache';

/**
 * True only for a local receipt uri: `file:///<...>/cache/<...>/<name>.pdf`.
 *
 * Why so strict: `react-native-pdf` runs `decodeURIComponent` on the path
 * before handing it to native code, so a percent-encoded `%2e%2e` or `%2f`
 * would slip past a literal `..` check and decode into a traversal. The uri
 * expo-print produces (Android `Uri.fromFile` on `cacheDir/Print/<name>.pdf`)
 * never contains percent-encoding, so any `%` is rejected outright. The
 * receipt only ever lives in the app cache, so a path outside a `/cache/`
 * directory segment is treated as a planted deep link. Also rejected: any
 * host (`file://host/...`), query, fragment, and empty, `.` or `..` segments.
 */
export function isReceiptPdfUri(uri: string): boolean {
  if (uri.includes('%') || !RECEIPT_PDF_URI.test(uri)) {
    return false;
  }
  const segments = uri.slice('file:///'.length).split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false;
  }
  return segments.slice(0, -1).includes(APP_CACHE_SEGMENT);
}

/** The only value that marks a protected receipt in the route. */
const ENCRYPTED_FLAG = '1';

function singleNonEmptyString(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseReceiptViewerParams(raw: RawReceiptViewerParams): ReceiptViewerParams {
  const employeeId = singleNonEmptyString(raw.employeeId);
  const runId = singleNonEmptyString(raw.runId);
  const uri = singleNonEmptyString(raw.uri);
  if (employeeId === null || runId === null || uri === null || !isReceiptPdfUri(uri)) {
    return { ok: false };
  }
  return { ok: true, employeeId, runId, uri, encrypted: raw.encrypted === ENCRYPTED_FLAG };
}
