import { getRandomValues } from 'expo-crypto';
import * as Print from 'expo-print';

import { A4_HEIGHT_PX, A4_WIDTH_PX, ExpoPrintReceiptGenerator } from './ExpoPrintReceiptGenerator';
import { encryptPdfBytes } from './encryptPdfBytes';
import { installSecureRandom } from './secureRandom';

// In-memory stand-in for the expo-file-system `File`/`Paths` pair. Names start
// with `mock` so the hoisted `jest.mock` factory may reference them.
const mockFileStore = new Map<string, Uint8Array>();
const mockFileOps: string[] = [];
let mockDeleteError: Error | null = null;
let mockWriteError: Error | null = null;

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///fake/cache/' } },
  File: class MockFile {
    readonly uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists(): boolean {
      return mockFileStore.has(this.uri);
    }
    async bytes(): Promise<Uint8Array> {
      mockFileOps.push(`bytes ${this.uri}`);
      const content = mockFileStore.get(this.uri);
      if (!content) throw new Error('missing file');
      return content;
    }
    write(content: Uint8Array): void {
      mockFileOps.push(`write ${this.uri}`);
      if (mockWriteError) throw mockWriteError;
      mockFileStore.set(this.uri, content);
    }
    delete(): void {
      mockFileOps.push(`delete ${this.uri}`);
      if (mockDeleteError) throw mockDeleteError;
      mockFileStore.delete(this.uri);
    }
  },
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ getRandomValues: jest.fn() }));
jest.mock('./secureRandom', () => ({ installSecureRandom: jest.fn() }));
jest.mock('./encryptPdfBytes', () => ({ encryptPdfBytes: jest.fn() }));

const printToFileAsync = jest.mocked(Print.printToFileAsync);
const encrypt = jest.mocked(encryptPdfBytes);
const install = jest.mocked(installSecureRandom);

const PLAIN_URI = 'file:///fake/cache/Print/recibo.pdf';
const PLAIN_BYTES = new Uint8Array([1, 2, 3]);
const ENCRYPTED_BYTES = new Uint8Array([9, 9, 9, 9]);
const PASSWORD = '00000000T';

describe('ExpoPrintReceiptGenerator', () => {
  beforeEach(() => {
    printToFileAsync.mockReset();
    printToFileAsync.mockResolvedValue({ uri: PLAIN_URI, numberOfPages: 1 });
    encrypt.mockReset();
    encrypt.mockResolvedValue(ENCRYPTED_BYTES);
    install.mockReset();
    mockFileStore.clear();
    mockFileStore.set(PLAIN_URI, PLAIN_BYTES);
    mockFileOps.length = 0;
    mockDeleteError = null;
    mockWriteError = null;
  });

  it('renders the HTML at A4 page size instead of the US Letter default', async () => {
    const generator = new ExpoPrintReceiptGenerator();

    await generator.generate('<html><body>recibo</body></html>');

    expect(printToFileAsync).toHaveBeenCalledTimes(1);
    expect(printToFileAsync).toHaveBeenCalledWith({
      html: '<html><body>recibo</body></html>',
      width: 595,
      height: 842,
    });
  });

  it('exports the A4 dimensions it passes to expo-print', () => {
    expect(A4_WIDTH_PX).toBe(595);
    expect(A4_HEIGHT_PX).toBe(842);
  });

  it('returns only the generated file uri', async () => {
    const generator = new ExpoPrintReceiptGenerator();

    const result = await generator.generate('<html></html>');

    expect(result).toEqual({ uri: PLAIN_URI });
  });

  describe('without a password (default path, spec R9 S5)', () => {
    it('never touches the file, the encryptor or the random shim', async () => {
      const generator = new ExpoPrintReceiptGenerator();

      const result = await generator.generate('<html></html>');

      expect(result).toEqual({ uri: PLAIN_URI });
      expect(mockFileOps).toEqual([]);
      expect(encrypt).not.toHaveBeenCalled();
      expect(install).not.toHaveBeenCalled();
      expect(mockFileStore.get(PLAIN_URI)).toBe(PLAIN_BYTES);
    });

    it('treats an options object without a password as plain', async () => {
      const generator = new ExpoPrintReceiptGenerator();

      await generator.generate('<html></html>', {});

      expect(mockFileOps).toEqual([]);
      expect(encrypt).not.toHaveBeenCalled();
    });
  });

  describe('with a password (spec R9 S1/S3/S4)', () => {
    it('reads the plain bytes, encrypts them and overwrites the same uri', async () => {
      const generator = new ExpoPrintReceiptGenerator();

      const result = await generator.generate('<html></html>', { password: PASSWORD });

      expect(result).toEqual({ uri: PLAIN_URI });
      expect(encrypt).toHaveBeenCalledWith(PLAIN_BYTES, PASSWORD);
      expect(mockFileOps).toEqual([`bytes ${PLAIN_URI}`, `write ${PLAIN_URI}`]);
      expect(mockFileStore.get(PLAIN_URI)).toBe(ENCRYPTED_BYTES);
    });

    it('installs the expo-crypto random source BEFORE encrypting', async () => {
      const order: string[] = [];
      install.mockImplementation(() => {
        order.push('install');
      });
      encrypt.mockImplementation(async () => {
        order.push('encrypt');
        return ENCRYPTED_BYTES;
      });
      const generator = new ExpoPrintReceiptGenerator();

      await generator.generate('<html></html>', { password: PASSWORD });

      expect(install).toHaveBeenCalledWith(getRandomValues);
      expect(order).toEqual(['install', 'encrypt']);
    });

    it('deletes the plain file and rejects with a fixed error when encryption throws', async () => {
      encrypt.mockRejectedValue(new Error(`lib exploded with ${PASSWORD}`));
      const generator = new ExpoPrintReceiptGenerator();

      let failure: unknown = null;
      await generator.generate('<html></html>', { password: PASSWORD }).catch((error: unknown) => {
        failure = error;
      });

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toBe('Receipt encryption failed');
      expect((failure as Error).message).not.toContain(PASSWORD);
      expect(mockFileOps).toContain(`delete ${PLAIN_URI}`);
      expect(mockFileStore.has(PLAIN_URI)).toBe(false);
    });

    it('deletes the plain file and rejects when the secure random source cannot be installed', async () => {
      install.mockImplementation(() => {
        throw new Error('Secure random source unavailable');
      });
      const generator = new ExpoPrintReceiptGenerator();

      let failure: unknown = null;
      await generator.generate('<html></html>', { password: PASSWORD }).catch((error: unknown) => {
        failure = error;
      });

      expect((failure as Error).message).toBe('Receipt encryption failed');
      expect(encrypt).not.toHaveBeenCalled();
      expect(mockFileStore.has(PLAIN_URI)).toBe(false);
    });

    it('deletes the plain file and rejects when the write fails after encrypting', async () => {
      mockWriteError = new Error('disk full');
      const generator = new ExpoPrintReceiptGenerator();

      let failure: unknown = null;
      await generator.generate('<html></html>', { password: PASSWORD }).catch((error: unknown) => {
        failure = error;
      });

      expect((failure as Error).message).toBe('Receipt encryption failed');
      expect(encrypt).toHaveBeenCalledTimes(1);
      expect(mockFileOps).toContain(`delete ${PLAIN_URI}`);
      expect(mockFileStore.has(PLAIN_URI)).toBe(false);
    });

    it('still rejects with the fixed error when deleting the plain file also fails', async () => {
      encrypt.mockRejectedValue(new Error('boom'));
      mockDeleteError = new Error('cannot delete');
      const generator = new ExpoPrintReceiptGenerator();

      let failure: unknown = null;
      await generator.generate('<html></html>', { password: PASSWORD }).catch((error: unknown) => {
        failure = error;
      });

      expect((failure as Error).message).toBe('Receipt encryption failed');
    });

    it('rejects an empty password before printing anything', async () => {
      const generator = new ExpoPrintReceiptGenerator();

      let failure: unknown = null;
      await generator.generate('<html></html>', { password: '' }).catch((error: unknown) => {
        failure = error;
      });

      expect(failure).toBeInstanceOf(Error);
      expect(printToFileAsync).not.toHaveBeenCalled();
      expect(mockFileOps).toEqual([]);
    });

    it.each([
      ['longer than 32 characters (the AES-128 writer would truncate it silently)', 'a'.repeat(33)],
      ['with a Latin-1 accent (the viewer reads it as different bytes)', 'clavé-secreta'],
      ['with a character above U+00FF', 'clave€'],
      ['with a control character', 'cla\tve'],
      ['with an emoji', 'clave\u{1F600}'],
    ])('rejects a password %s before printing, without leaking it', async (_label, password) => {
      const generator = new ExpoPrintReceiptGenerator();

      let failure: unknown = null;
      await generator.generate('<html></html>', { password }).catch((error: unknown) => {
        failure = error;
      });

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).not.toContain(password);
      expect(printToFileAsync).not.toHaveBeenCalled();
      expect(encrypt).not.toHaveBeenCalled();
      expect(install).not.toHaveBeenCalled();
      expect(mockFileOps).toEqual([]);
      expect(mockFileStore.get(PLAIN_URI)).toBe(PLAIN_BYTES);
    });

    it('accepts a password of exactly 32 printable ASCII characters', async () => {
      const generator = new ExpoPrintReceiptGenerator();
      const password = 'Ab 1~'.padEnd(32, 'x');

      await expect(generator.generate('<html></html>', { password })).resolves.toEqual({ uri: PLAIN_URI });
      expect(encrypt).toHaveBeenCalledWith(PLAIN_BYTES, password);
    });

    it('propagates a print failure untouched and encrypts nothing', async () => {
      printToFileAsync.mockRejectedValue(new Error('print failed'));
      const generator = new ExpoPrintReceiptGenerator();

      await expect(generator.generate('<html></html>', { password: PASSWORD })).rejects.toThrow('print failed');
      expect(encrypt).not.toHaveBeenCalled();
    });
  });

  describe('discard', () => {
    const CACHED_URI = 'file:///fake/cache/Print/old.pdf';

    it('deletes a pdf inside the app cache', async () => {
      mockFileStore.set(CACHED_URI, PLAIN_BYTES);
      const generator = new ExpoPrintReceiptGenerator();

      await generator.discard(CACHED_URI);

      expect(mockFileStore.has(CACHED_URI)).toBe(false);
    });

    it.each([
      ['outside the cache', 'file:///fake/documents/recibo.pdf'],
      ['not a pdf', 'file:///fake/cache/Print/notes.txt'],
      ['escaping the cache with ..', 'file:///fake/cache/../documents/recibo.pdf'],
    ])('does nothing for a uri %s', async (_label, uri) => {
      mockFileStore.set(uri, PLAIN_BYTES);
      const generator = new ExpoPrintReceiptGenerator();

      await generator.discard(uri);

      expect(mockFileStore.has(uri)).toBe(true);
      expect(mockFileOps).toEqual([]);
    });

    it('is a no-op for a file that is already gone', async () => {
      const generator = new ExpoPrintReceiptGenerator();

      await expect(generator.discard(CACHED_URI)).resolves.toBeUndefined();
      expect(mockFileOps).toEqual([]);
    });

    it('never throws when the delete fails', async () => {
      mockFileStore.set(CACHED_URI, PLAIN_BYTES);
      mockDeleteError = new Error('cannot delete');
      const generator = new ExpoPrintReceiptGenerator();

      await expect(generator.discard(CACHED_URI)).resolves.toBeUndefined();
      expect(mockFileOps).toContain(`delete ${CACHED_URI}`);
    });
  });
});
