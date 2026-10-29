/**
 * Pure PDF byte encryption for password-protected receipts (design D1/D9).
 * Adapter-internal: only `ExpoPrintReceiptGenerator` calls it, and the
 * `@cantoo/pdf-lib` import is sealed to `src/services/pdf/**` by ESLint.
 *
 * The user (open) password is the ONLY protection set: no owner password and
 * no restrictive permissions, because the feature prevents accidental opening
 * and must not claim permission control (spec R5/R9).
 */

import { PDFDocument, type SecurityOptions } from '@cantoo/pdf-lib';

import { assertSecureRandom } from './secureRandom';

/**
 * Single switch point for the cipher (design D9). Verified against the
 * installed `@cantoo/pdf-lib` 2.11.1 declarations
 * (`cjs/core/security/PDFSecurity.d.ts`):
 * `EncryptionAlgorithm = 'AES-256' | 'AES-128' | 'RC4-128' | 'RC4-40'`
 * (default 'AES-256'; RC4 needs `allowWeakCryptography`), and
 * `SaveOptions.useObjectStreams?: boolean` (`PDFDocumentOptions.d.ts`).
 *
 * 'AES-256' writes /V 5 /R 6 /CFM /AESV3 and caps the password at 127 UTF-8
 * bytes (`RECEIPT_PASSWORD_MAX_BYTES` in core). If the device spike shows
 * react-native-pdf cannot open R6, switch to 'AES-128' (V4/R4/AESV2, 32-byte
 * Latin-1 password) and change the coupled constant and Jest regexes together.
 */
export const RECEIPT_ENCRYPTION_ALGORITHM = 'AES-256' satisfies NonNullable<SecurityOptions['algorithm']>;

/**
 * Object streams MUST stay on. In 2.11.1 the classic writer (`PDFWriter`) only
 * encrypts STREAM contents, so every string left outside a stream (Info
 * /Producer, /CreationDate, any /Title...) would be written in cleartext inside
 * an encrypted file, which a reader then "decrypts" into garbage. With object
 * streams (`PDFStreamWriter`) every non-stream object lives inside an
 * encrypted `/ObjStm`, which is the spec-correct way to protect them. The
 * regression test asserts that no input metadata survives in cleartext.
 */
const SAVE_OPTIONS = { useObjectStreams: true } as const;

/**
 * Every permission is granted. The library default (no `permissions`) writes
 * `/P -3904`, i.e. print, modify, copy and annotate all DENIED, which a viewer
 * that authenticates only at user level would enforce against the employee.
 * The feature stops accidental opening; it makes no permission claims (spec
 * R5/R9), so nothing is restricted. No `ownerPassword` is set: the library then
 * reuses the user password.
 */
const ALL_PERMISSIONS = {
  printing: 'highResolution',
  modifying: true,
  copying: true,
  annotating: true,
  fillingForms: true,
  contentAccessibility: true,
  documentAssembly: true,
} as const satisfies NonNullable<SecurityOptions['permissions']>;

/**
 * Encrypts `plain` PDF bytes with `password` as the open password.
 *
 * Requires an installed secure random source (`installSecureRandom`): without
 * it the library would silently fall back to `Math.random()` for per-string
 * IVs, so this rejects instead (spec R9 S4).
 */
export async function encryptPdfBytes(plain: Uint8Array, password: string): Promise<Uint8Array> {
  assertSecureRandom();

  const doc = await PDFDocument.load(plain, { updateMetadata: false });
  doc.encrypt({
    userPassword: password,
    algorithm: RECEIPT_ENCRYPTION_ALGORITHM,
    permissions: ALL_PERMISSIONS,
  });
  return doc.save(SAVE_OPTIONS);
}
