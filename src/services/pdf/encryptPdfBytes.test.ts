/**
 * Round-trip tests for `encryptPdfBytes` (spec R9 S1/S2/S4, design "Testing
 * Strategy"). The plain input is built with `PDFDocument.create()` and the
 * output is inspected both through the library (load with / without a
 * password) and byte-level (the /Encrypt dictionary), because a same-library
 * round trip cannot catch a spec-incorrect writer: the real oracle is the
 * device spike (react-native-pdf opens the file).
 *
 * Only placeholder passwords (`00000000T`, `X0000000T`) are used (CLAUDE.md §6).
 */

import { randomFillSync } from 'node:crypto';

import { PDFDocument } from '@cantoo/pdf-lib';

import { RECEIPT_ENCRYPTION_ALGORITHM, encryptPdfBytes } from './encryptPdfBytes';
import { installSecureRandom } from './secureRandom';

const PASSWORD = '00000000T';
const TITLE = 'Recibo de prueba';

const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

function removeGlobalCrypto(): void {
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
}

function latin1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

/** PDF writes metadata strings as `<FEFF...>` UTF-16BE hex. */
function utf16BeHex(text: string): string {
  return [...text].map((char) => char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
}

async function buildPlainPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle(TITLE);
  // No object streams so the Info strings are visible byte-for-byte.
  return doc.save({ useObjectStreams: false });
}

/** Installs the shim over a removed global, counting source calls. */
function installCountingSource(): jest.Mock<Uint8Array, [Uint8Array]> {
  removeGlobalCrypto();
  const source = jest.fn((array: Uint8Array): Uint8Array => randomFillSync(array));
  installSecureRandom(source);
  return source;
}

afterEach(() => {
  jest.restoreAllMocks();
  if (cryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'crypto');
  }
});

describe('RECEIPT_ENCRYPTION_ALGORITHM', () => {
  it('is AES-128 (V4/R4), the switch point coupled to RECEIPT_PASSWORD_MAX_LENGTH = 32', () => {
    expect(RECEIPT_ENCRYPTION_ALGORITHM).toBe('AES-128');
  });
});

describe('encryptPdfBytes', () => {
  it('produces a file that opens with the right password and keeps the page count', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();

    const encrypted = await encryptPdfBytes(plain, PASSWORD);

    const reopened = await PDFDocument.load(encrypted, { password: PASSWORD });
    expect(reopened.getPageCount()).toBe(1);
  });

  it('rejects when opened with no password', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();

    const encrypted = await encryptPdfBytes(plain, PASSWORD);

    await expect(PDFDocument.load(encrypted)).rejects.toThrow(/encrypted/i);
  });

  it('rejects when opened with a wrong password', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();

    const encrypted = await encryptPdfBytes(plain, PASSWORD);

    await expect(PDFDocument.load(encrypted, { password: '00000001T' })).rejects.toThrow(/password/i);
  });

  it('writes a Standard handler V4 / R4 / AESV2 /Encrypt dictionary and no cleartext metadata', async () => {
    const plain = await buildPlainPdf();
    expect(latin1(plain).toLowerCase()).toContain(utf16BeHex(TITLE));
    installCountingSource();

    const encrypted = await encryptPdfBytes(plain, PASSWORD);

    const text = latin1(encrypted);
    expect(text).toMatch(/\/Encrypt\s+\d+\s+0\s+R/);
    expect(text).toMatch(/\/Filter\s*\/Standard/);
    expect(text).toMatch(/\/V\s+4\b/);
    expect(text).toMatch(/\/R\s+4\b/);
    expect(text).toMatch(/\/AESV2/);
    expect(text).not.toMatch(/\/AESV3/);
    expect(text.toLowerCase()).not.toContain(utf16BeHex(TITLE));
  });

  it('does not restrict what the recipient can do: every permission bit is granted', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();

    const encrypted = await encryptPdfBytes(plain, PASSWORD);

    const permissions = Number(/\/P\s+(-?\d+)/.exec(latin1(encrypted))?.[1]);
    // PDF 32000-1 table 22 (1-based bits): 3 print, 4 modify, 5 copy, 6 annotate,
    // 9 fill forms, 10 accessibility, 11 assemble, 12 high-quality print.
    const grantedBits = [3, 4, 5, 6, 9, 10, 11, 12];
    expect(Number.isInteger(permissions)).toBe(true);
    for (const bit of grantedBits) {
      expect(permissions & (1 << (bit - 1))).not.toBe(0);
    }
  });

  it('sets no separate owner password: the user password opens the file with full access', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();

    const encrypted = await encryptPdfBytes(plain, PASSWORD);

    // The library falls back to owner == user when no owner password is given,
    // so the only credential that exists is the one derived from the employee.
    await expect(PDFDocument.load(encrypted, { password: PASSWORD })).resolves.toBeInstanceOf(PDFDocument);
    await expect(PDFDocument.load(encrypted, { password: 'owner-secret' })).rejects.toThrow(/password/i);
  });

  it('draws every random byte from the injected source and never from Math.random', async () => {
    const plain = await buildPlainPdf();
    const source = installCountingSource();
    // Count the self-test call made by the install; encryption must add more.
    const callsAfterInstall = source.mock.calls.length;
    const mathRandom = jest.spyOn(Math, 'random');

    await encryptPdfBytes(plain, PASSWORD);

    expect(mathRandom).toHaveBeenCalledTimes(0);
    expect(source.mock.calls.length).toBeGreaterThan(callsAfterInstall);
  });

  it('produces different ciphertext on every call (fresh key, salts and IVs)', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();

    const first = await encryptPdfBytes(plain, PASSWORD);
    const second = await encryptPdfBytes(plain, PASSWORD);

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
  });

  it('round-trips an NIE-shaped password', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();

    const encrypted = await encryptPdfBytes(plain, 'X0000000T');

    const reopened = await PDFDocument.load(encrypted, { password: 'X0000000T' });
    expect(reopened.getPageCount()).toBe(1);
    await expect(PDFDocument.load(encrypted, { password: PASSWORD })).rejects.toThrow(/password/i);
  });

  it('round-trips a password of exactly 32 characters, the R4 limit', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();
    const password = `${'a'.repeat(31)}Z`;
    expect(password).toHaveLength(32);

    const encrypted = await encryptPdfBytes(plain, password);

    const reopened = await PDFDocument.load(encrypted, { password });
    expect(reopened.getPageCount()).toBe(1);
    await expect(PDFDocument.load(encrypted, { password: `${'a'.repeat(31)}Y` })).rejects.toThrow(/password/i);
  });

  // Characterization of the writer behaviour that `validateReceiptPasswordOverride`
  // exists to prevent (verified in @cantoo/pdf-lib 2.11.1 `processPasswordR2R3R4`):
  // anything after the 32nd UTF-16 code unit is silently dropped, so the file
  // would open with a password the employer never typed.
  it('silently truncates a password longer than 32 characters (why core must reject it)', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();
    const tooLong = `${'a'.repeat(32)}TAIL`;

    const encrypted = await encryptPdfBytes(plain, tooLong);

    const reopened = await PDFDocument.load(encrypted, { password: 'a'.repeat(32) });
    expect(reopened.getPageCount()).toBe(1);
  });

  it('refuses a character above U+00FF instead of encoding it differently', async () => {
    const plain = await buildPlainPdf();
    installCountingSource();

    await expect(encryptPdfBytes(plain, 'clave€')).rejects.toThrow(/invalid characters/i);
  });

  it('throws before encrypting when no secure random source is installed', async () => {
    const plain = await buildPlainPdf();
    removeGlobalCrypto();
    const mathRandom = jest.spyOn(Math, 'random');

    // Capture the outcome WITHOUT touching `error.stack`: Jest's `toThrow`
    // matcher reads it, and source-map-support calls Math.random while mapping
    // it, which would pollute the spy.
    let failure: unknown = null;
    await encryptPdfBytes(plain, PASSWORD).catch((error: unknown) => {
      failure = error;
    });
    const mathRandomCalls = mathRandom.mock.calls.length;
    mathRandom.mockRestore();

    expect(mathRandomCalls).toBe(0);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('Secure random source unavailable');
  });
});
