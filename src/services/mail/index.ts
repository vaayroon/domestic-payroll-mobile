/**
 * services/mail — dispatch (expo-mail-composer / expo-sharing), sends the
 * generated receipt to the employee. Sealed behind the `PdfSharer`/
 * `MailSender` interfaces in `src/types` (CLAUDE.md §3) — this is the ONLY
 * directory allowed to import `expo-sharing`/`expo-mail-composer`.
 */

export * from './ExpoSharingPdfSharer';
export * from './ExpoMailSender';
