/**
 * Concrete `ReceiptPdfGenerator` adapter wrapping `expo-print`. This is the
 * ONLY file allowed to import `expo-print` (enforced by the `no-restricted-imports`
 * ESLint rule in `eslint.config.js`, mirroring the Drizzle seal in
 * `src/services/db/`) — `features/*` and `core/*` depend on the
 * `ReceiptPdfGenerator` interface in `src/types` instead.
 *
 * Page size: `expo-print` defaults to US Letter (612 x 792 px at 72 PPI) when
 * `width`/`height` are omitted. The official Recibo Individual de Salarios is
 * an A4 document, so this adapter always passes A4 explicitly. The API takes
 * integer px at 72 PPI (1 px = 1 pt): 210 mm = 595.28 and 297 mm = 841.89,
 * so 595 x 842 lands within 0.3 pt of exact A4. On Android, `expo-print`
 * converts them to mils and builds a `PrintAttributes.MediaSize` from them
 * with no minimum margins (`PrintPDFRenderTask.kt`), so the `@page` margins
 * declared in `buildReceiptHtml` are expected to keep governing the layout.
 * That, and any reflow of the receipt tables at the narrower width, can only
 * be confirmed on a device: the print layout is not unit-testable.
 */

import * as Print from 'expo-print';

import type { ReceiptPdfGenerator } from '@/types';

/** A4 width in pixels at 72 PPI (210 mm). */
export const A4_WIDTH_PX = 595;

/** A4 height in pixels at 72 PPI (297 mm). */
export const A4_HEIGHT_PX = 842;

export class ExpoPrintReceiptGenerator implements ReceiptPdfGenerator {
  async generate(html: string): Promise<{ readonly uri: string }> {
    const { uri } = await Print.printToFileAsync({
      html,
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
    });
    return { uri };
  }
}
