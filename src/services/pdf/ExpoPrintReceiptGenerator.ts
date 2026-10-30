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
 * message carries neither the password nor any library text. A password the
 * AES-128 writer would mangle (empty, over 32 characters or outside printable
 * ASCII, the rule in `core/receiptPassword`) is rejected before printing.
 *
 * Readable file name (design D1-D5 of `sdd/receipt-file-name`): `expo-print`
 * always writes `cache/Print/<random>.pdf`. With `options.fileName` the printed
 * file is MOVED into a fresh `cache/receipts/<uuid>/` directory under that name,
 * and encryption then runs at the new uri. The directory is the collision
 * guard: the uuid is new on every call, so the same name never overwrites
 * (`File.move` does not overwrite on its own) and a regeneration always
 * yields a different uri, which is what resets the "sent" state upstream.
 * Naming is cosmetic, so every failure while placing the file falls back to the
 * random name instead of rejecting; only the password rules are a gate.
 *
 * `@cantoo/pdf-lib`, `expo-file-system` and the expo-crypto random-bytes API
 * are sealed to `src/services/pdf/` by `eslint.config.js`.
 */

import { getRandomValues, randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';

import { isSafeReceiptFileName } from '@/core/receiptFileName';
import { isReceiptPasswordWritable } from '@/core/receiptPassword';
import type { ReceiptPdfGenerateOptions, ReceiptPdfGenerator } from '@/types';

import { encryptPdfBytes } from './encryptPdfBytes';
import { installSecureRandom } from './secureRandom';

/** A4 width in pixels at 72 PPI (210 mm). */
export const A4_WIDTH_PX = 595;

/** A4 height in pixels at 72 PPI (297 mm). */
export const A4_HEIGHT_PX = 842;

const ENCRYPTION_FAILED_MESSAGE = 'Receipt encryption failed';
const INVALID_PASSWORD_MESSAGE = 'Receipt password is empty, too long or not printable ASCII';

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

/** Parent directory of every readable-name file, directly under the app cache. */
const RECEIPTS_DIRECTORY = 'receipts';

/** Exactly `receipts/<uuid>/<file>.pdf`, relative to the app cache. The uuid is the one `randomUUID` produces. */
const RECEIPT_FILE_PATH =
  /^receipts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[^/]+\.pdf$/i;

/**
 * Removes `directory` only when it exists and holds nothing. `Directory.delete`
 * is recursive, so the emptiness check is what keeps this from ever taking a
 * sibling file with it.
 */
function deleteEmptyDirectoryQuietly(directory: Directory): void {
  try {
    if (directory.exists && directory.list().length === 0) {
      directory.delete();
    }
  } catch {
    // Best effort only.
  }
}

/**
 * Deletes a receipt file and, when it lived in its own `receipts/<uuid>/`
 * directory, that directory too once it is empty. Anything that does not match
 * that exact shape (the random `Print/` files, a foreign path) only loses the
 * file, never a directory.
 */
function deleteReceiptQuietly(uri: string): void {
  deleteQuietly(uri);
  const cacheRoot = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
  if (!uri.startsWith(cacheRoot)) {
    return;
  }
  const directoryName = RECEIPT_FILE_PATH.exec(uri.slice(cacheRoot.length))?.[1];
  if (directoryName !== undefined) {
    deleteEmptyDirectoryQuietly(new Directory(Paths.cache, RECEIPTS_DIRECTORY, directoryName));
  }
}

/** Reads `file.exists`, which is a native getter and can throw, as `false` when it does. */
function existsQuietly(file: File | null): boolean {
  try {
    return file?.exists === true;
  } catch {
    return false;
  }
}

/**
 * Moves the printed file to `cache/receipts/<uuid>/<fileName>.pdf` and returns
 * its new uri, or `printedUri` when that is not possible. Never throws.
 *
 * `File.move` updates the instance's `uri`, so the new location is read back
 * from it. If `move` throws AFTER having moved the file the target exists, and
 * returning the printed uri would point at a file that is gone, so the target
 * wins. Otherwise the directory created for the move is removed when empty.
 */
function placeUnderReadableName(printedUri: string, fileName: string): string {
  let directory: Directory | null = null;
  let target: File | null = null;
  try {
    directory = new Directory(Paths.cache, RECEIPTS_DIRECTORY, randomUUID());
    target = new File(directory, `${fileName}.pdf`);
    directory.create({ intermediates: true });
    const printed = new File(printedUri);
    printed.move(target);
    return printed.uri;
  } catch {
    if (target !== null && existsQuietly(target)) {
      return target.uri;
    }
    if (directory !== null) {
      deleteEmptyDirectoryQuietly(directory);
    }
    return printedUri;
  }
}

export class ExpoPrintReceiptGenerator implements ReceiptPdfGenerator {
  async generate(
    html: string,
    options?: ReceiptPdfGenerateOptions,
  ): Promise<{ readonly uri: string }> {
    const password = options?.password;
    // Defence in depth: callers validate with the same rule, but with AES-128
    // (R4) the writer would truncate after 32 characters without a word and the
    // viewer cannot open U+0080-U+00FF. Fail before printing so no plain file
    // exists. The message never carries the password.
    if (password !== undefined && !isReceiptPasswordWritable(password)) {
      throw new Error(INVALID_PASSWORD_MESSAGE);
    }

    const printed = await Print.printToFileAsync({
      html,
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
    });
    // An unsafe name is ignored, not rejected: no file operation happens and
    // the random `Print/` name stays.
    const fileName = options?.fileName;
    const uri =
      fileName !== undefined && isSafeReceiptFileName(fileName)
        ? placeUnderReadableName(printed.uri, fileName)
        : printed.uri;
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
      deleteReceiptQuietly(uri);
      throw new Error(ENCRYPTION_FAILED_MESSAGE);
    }
    return { uri };
  }

  async discard(uri: string): Promise<void> {
    if (!isDiscardableCacheUri(uri)) {
      return;
    }
    deleteReceiptQuietly(uri);
  }
}
