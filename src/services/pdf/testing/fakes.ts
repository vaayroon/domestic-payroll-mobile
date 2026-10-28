/**
 * In-memory `ReceiptPdfGenerator` fake for unit tests (design ADR-6). Real
 * `expo-print` cannot run under `jest-expo` headless, so hooks/screens are
 * exercised against this fake instead, through `PdfServiceProvider`.
 */

import type { ReceiptPdfGenerator } from '@/types';

export class FakeReceiptPdfGenerator implements ReceiptPdfGenerator {
  private nextId = 0;

  /** The HTML passed to the most recent `generate` call, for assertions. */
  lastHtml: string | null = null;

  async generate(html: string): Promise<{ readonly uri: string }> {
    this.lastHtml = html;
    this.nextId += 1;
    return { uri: `file:///fake/cache/Print/recibo-${this.nextId}.pdf` };
  }
}
