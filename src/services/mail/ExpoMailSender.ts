/**
 * Concrete `MailSender` adapter wrapping `expo-mail-composer`. This is the
 * ONLY file allowed to import `expo-mail-composer` (enforced by the
 * `no-restricted-imports` ESLint rule in `eslint.config.js`, mirroring the
 * `expo-print` seal in `src/services/pdf/`) — `features/*` and `core/*`
 * depend on the `MailSender` interface in `src/types` instead.
 */

import * as MailComposer from 'expo-mail-composer';

import type { MailSender, MailSendResult } from '@/types';

/**
 * Explicit switch mapper from `MailComposer.MailComposerStatus` to the
 * domain `MailSendResult` union (design ADR-2 risk 4) — the string values
 * are identical, but the library's own enum type must never cross the
 * `src/services/mail/` boundary, so no direct assignment or `as` cast.
 */
function toMailSendResult(status: MailComposer.MailComposerStatus): MailSendResult {
  switch (status) {
    case MailComposer.MailComposerStatus.SENT:
      return 'sent';
    case MailComposer.MailComposerStatus.SAVED:
      return 'saved';
    case MailComposer.MailComposerStatus.CANCELLED:
      return 'cancelled';
    case MailComposer.MailComposerStatus.UNDETERMINED:
      return 'undetermined';
  }
}

export class ExpoMailSender implements MailSender {
  async isAvailable(): Promise<boolean> {
    return MailComposer.isAvailableAsync();
  }

  async send({
    subject,
    body,
    attachmentUris,
  }: {
    readonly subject: string;
    readonly body: string;
    readonly attachmentUris: readonly string[];
  }): Promise<MailSendResult> {
    const { status } = await MailComposer.composeAsync({ subject, body, attachments: [...attachmentUris] });
    return toMailSendResult(status);
  }
}
