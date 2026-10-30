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
 * 'AES-128' writes /V 4 /R 4 /CFM /AESV2. It replaced the library default
 * 'AES-256' (V5/R6) after the device spike on the Android development build:
 * R6 key derivation (ISO 32000-2 Algorithm 2.B, pure JS on Hermes) took about
 * 5.3 s inside `encrypt()` (5.7-6.2 s end to end), while R4 costs 3-5 ms there
 * (0.42-0.46 s end to end, dominated by load and save). The password is a
 * 9-character NIF/NIE, so the weak link is the password, not the key size.
 * react-native-pdf (pdfium) opens R4 with the right password and fails with a
 * wrong one.
 *
 * R4 PASSWORD ENCODING (read from `processPasswordR2R3R4` in
 * `cjs/core/security/PDFSecurity.js`, 2.11.1). The writer does NOT use UTF-8
 * and NOT PDFDocEncoding: it takes `password.charCodeAt(i)` per UTF-16 code
 * unit, THROWS ('Password contains one or more invalid characters.') above
 * U+00FF, SILENTLY STOPS at 32 code units, and pads shorter passwords with the
 * standard 32-byte padding string. That is Latin-1 with a 32-character cap.
 *
 * The in-app viewer reads it differently: pdfiumandroid passes the Kotlin
 * String through JNI `GetStringUTFChars` (modified UTF-8) and pdfium hashes
 * those raw bytes (`GetPassCode`, no transcoding, first 32 bytes). U+0080 to
 * U+00FF are therefore ONE byte for the writer and TWO for the viewer, so only
 * ASCII round-trips end to end. `RECEIPT_PASSWORD_MAX_LENGTH` and the
 * validation in `src/core/receiptPassword.ts` are coupled to this constant:
 * change them together.
 */
export const RECEIPT_ENCRYPTION_ALGORITHM = 'AES-128' satisfies NonNullable<SecurityOptions['algorithm']>;

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
