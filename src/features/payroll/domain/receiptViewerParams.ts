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
}

export type ReceiptViewerParams =
  | { readonly ok: true; readonly employeeId: string; readonly runId: string; readonly uri: string }
  | { readonly ok: false };

/** `file:///` + a path with no query/hash + `.pdf` (case-insensitive). */
const RECEIPT_PDF_URI = /^file:\/\/\/[^?#]+\.pdf$/i;

/** True only for a local `file:///...pdf` uri with no query, hash or `..` path segment. */
export function isReceiptPdfUri(uri: string): boolean {
  if (!RECEIPT_PDF_URI.test(uri)) {
    return false;
  }
  const path = uri.slice('file:///'.length);
  return !path.split('/').includes('..');
}

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
  return { ok: true, employeeId, runId, uri };
}
