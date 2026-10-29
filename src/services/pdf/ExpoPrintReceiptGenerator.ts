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
 *
 * Encryption (design D1/D3/D4): when a password is passed, the plain PDF that
 * `expo-print` wrote to the cache is read back, encrypted by `encryptPdfBytes`
 * and written over the SAME uri (`File.write` truncates). The plain bytes never
 * leave this adapter: on ANY failure the file is deleted and a fixed error is
 * thrown, so a plain uri is never returned for a password request. The error
 * message carries neither the password nor any library text.
 *
 * `@cantoo/pdf-lib`, `expo-file-system` and the expo-crypto random-bytes API
 * are sealed to `src/services/pdf/` by `eslint.config.js`.
 */

import { getRandomValues } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';

import type { ReceiptPdfGenerateOptions, ReceiptPdfGenerator } from '@/types';

import { encryptPdfBytes } from './encryptPdfBytes';
import { installSecureRandom } from './secureRandom';

/** A4 width in pixels at 72 PPI (210 mm). */
export const A4_WIDTH_PX = 595;

/** A4 height in pixels at 72 PPI (297 mm). */
export const A4_HEIGHT_PX = 842;

const ENCRYPTION_FAILED_MESSAGE = 'Receipt encryption failed';
const EMPTY_PASSWORD_MESSAGE = 'Receipt password must not be empty';

/** Deletes a file, swallowing every error (a leftover cache file is not worth masking the real failure). */
function deleteQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best effort only.
  }
}

/** True for a `.pdf` strictly inside the app cache directory, with no `..` escape. */
function isDiscardableCacheUri(uri: string): boolean {
  return uri.startsWith(Paths.cache.uri) && uri.toLowerCase().endsWith('.pdf') && !uri.includes('..');
}

export class ExpoPrintReceiptGenerator implements ReceiptPdfGenerator {
  async generate(
    html: string,
    options?: ReceiptPdfGenerateOptions,
  ): Promise<{ readonly uri: string }> {
    const password = options?.password;
    if (password !== undefined && password.length === 0) {
      throw new Error(EMPTY_PASSWORD_MESSAGE);
    }

    const { uri } = await Print.printToFileAsync({
      html,
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
    });
    if (password === undefined) {
      return { uri };
    }

    try {
      installSecureRandom(getRandomValues);
      const file = new File(uri);
      const plain = await file.bytes();
      const encrypted = await encryptPdfBytes(plain, password);
      file.write(encrypted);
    } catch {
      deleteQuietly(uri);
      throw new Error(ENCRYPTION_FAILED_MESSAGE);
    }
    return { uri };
  }

  async discard(uri: string): Promise<void> {
    if (!isDiscardableCacheUri(uri)) {
      return;
    }
    deleteQuietly(uri);
  }
}
