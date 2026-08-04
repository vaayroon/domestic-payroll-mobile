/**
 * Concrete `PdfSharer` adapter wrapping `expo-sharing`. This is the ONLY
 * file allowed to import `expo-sharing` (enforced by the `no-restricted-imports`
 * ESLint rule in `eslint.config.js`, mirroring the `expo-print` seal in
 * `src/services/pdf/`) — `features/*` and `core/*` depend on the `PdfSharer`
 * interface in `src/types` instead.
 */

import * as Sharing from 'expo-sharing';

import type { PdfSharer } from '@/types';

/** Android intent mime type routing for the generated receipt PDF. */
const PDF_MIME_TYPE = 'application/pdf';
/** iOS Uniform Type Identifier for the generated receipt PDF. */
const PDF_UTI = 'com.adobe.pdf';

export class ExpoSharingPdfSharer implements PdfSharer {
  async isAvailable(): Promise<boolean> {
    return Sharing.isAvailableAsync();
  }

  async share(uri: string, { dialogTitle }: { readonly dialogTitle: string }): Promise<void> {
    await Sharing.shareAsync(uri, { mimeType: PDF_MIME_TYPE, UTI: PDF_UTI, dialogTitle });
  }
}
