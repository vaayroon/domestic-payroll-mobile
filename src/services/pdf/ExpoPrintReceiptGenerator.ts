/**
 * Concrete `ReceiptPdfGenerator` adapter wrapping `expo-print`. This is the
 * ONLY file allowed to import `expo-print` (enforced by the `no-restricted-imports`
 * ESLint rule in `eslint.config.js`, mirroring the Drizzle seal in
 * `src/services/db/`) — `features/*` and `core/*` depend on the
 * `ReceiptPdfGenerator` interface in `src/types` instead.
 */

import * as Print from 'expo-print';

import type { ReceiptPdfGenerator } from '@/types';

export class ExpoPrintReceiptGenerator implements ReceiptPdfGenerator {
  async generate(html: string): Promise<{ readonly uri: string }> {
    const { uri } = await Print.printToFileAsync({ html });
    return { uri };
  }
}
