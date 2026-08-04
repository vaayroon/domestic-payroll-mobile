/**
 * In-memory `PdfSharer`/`MailSender` fakes for unit tests (design ADR-5).
 * Real `expo-sharing`/`expo-mail-composer` cannot run under `jest-expo`
 * headless, so hooks/views are exercised against these fakes instead,
 * through `MailServiceProvider`.
 */

import type { MailSender, MailSendResult, PdfSharer } from '@/types';

export class FakePdfSharer implements PdfSharer {
  /** Controls what `isAvailable()` resolves to. */
  available = true;

  /** The uri passed to the most recent `share` call, for assertions. */
  lastSharedUri: string | null = null;
  /** The dialog title passed to the most recent `share` call, for assertions. */
  lastDialogTitle: string | null = null;
  /** Number of times `share` was called. */
  shareCallCount = 0;

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async share(uri: string, { dialogTitle }: { readonly dialogTitle: string }): Promise<void> {
    this.lastSharedUri = uri;
    this.lastDialogTitle = dialogTitle;
    this.shareCallCount += 1;
  }
}

export class FakeMailSender implements MailSender {
  /** Controls what `isAvailable()` resolves to. */
  available = true;
  /** Controls what `send()` resolves to. */
  result: MailSendResult = 'sent';

  /** The options passed to the most recent `send` call, for assertions. */
  lastOptions: {
    readonly subject: string;
    readonly body: string;
    readonly attachmentUris: readonly string[];
  } | null = null;

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async send(options: {
    readonly subject: string;
    readonly body: string;
    readonly attachmentUris: readonly string[];
  }): Promise<MailSendResult> {
    this.lastOptions = options;
    return this.result;
  }
}
