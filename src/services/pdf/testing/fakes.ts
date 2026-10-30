/**
 * In-memory `ReceiptPdfGenerator` fake for unit tests (design ADR-6). Real
 * `expo-print` cannot run under `jest-expo` headless, so hooks/screens are
 * exercised against this fake instead, through `PdfServiceProvider`.
 */

import type { ReceiptPdfGenerateOptions, ReceiptPdfGenerator } from '@/types';

export class FakeReceiptPdfGenerator implements ReceiptPdfGenerator {
  private nextId = 0;

  /** The HTML passed to the most recent `generate` call, for assertions. */
  lastHtml: string | null = null;

  /** The password passed to the most recent `generate` call (`null` for a plain call). */
  lastPassword: string | null = null;

  /** The readable file name passed to the most recent `generate` call (`null` when none was given). */
  lastFileName: string | null = null;

  /** Every uri passed to `discard`, in call order. */
  readonly discarded: string[] = [];

  /** When set, the next `generate` call rejects with it once (after recording the call). */
  nextError: Error | null = null;

  async generate(html: string, options?: ReceiptPdfGenerateOptions): Promise<{ readonly uri: string }> {
    this.lastHtml = html;
    this.lastPassword = options?.password ?? null;
    this.lastFileName = options?.fileName ?? null;
    if (this.nextError !== null) {
      const error = this.nextError;
      this.nextError = null;
      throw error;
    }
    this.nextId += 1;
    // A named file lives in its own directory, like the real adapter's
    // `receipts/<uuid>/`, so two generations never share a uri.
    return {
      uri:
        this.lastFileName === null
          ? `file:///fake/cache/Print/recibo-${this.nextId}.pdf`
          : `file:///fake/cache/receipts/fake-${this.nextId}/${this.lastFileName}.pdf`,
    };
  }

  async discard(uri: string): Promise<void> {
    this.discarded.push(uri);
  }
}
