import { getRandomValues, randomUUID } from 'expo-crypto';
import * as Print from 'expo-print';

import { A4_HEIGHT_PX, A4_WIDTH_PX, ExpoPrintReceiptGenerator } from './ExpoPrintReceiptGenerator';
import { encryptPdfBytes } from './encryptPdfBytes';
import { installSecureRandom } from './secureRandom';

// In-memory stand-in for the expo-file-system `File`/`Directory`/`Paths` trio.
// Names start with `mock` so the hoisted `jest.mock` factory may reference them.
// Like the real module it joins variadic parts, mutates `uri` on `move`, only
// moves into an existing directory, and deletes a directory RECURSIVELY (which
// is exactly why the adapter must check a directory is empty before deleting).
const mockFileStore = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>();
const mockFileOps: string[] = [];
const mockMkdirOptions: unknown[] = [];
let mockDeleteError: Error | null = null;
let mockWriteError: Error | null = null;
let mockMkdirError: Error | null = null;
let mockRmdirError: Error | null = null;
let mockMoveFailure: { readonly error: Error; readonly afterMoving: boolean } | null = null;

function mockJoinUri(parts: readonly (string | { readonly uri: string })[]): string {
  return parts
    .map((part, index) => {
      const text = typeof part === 'string' ? part : part.uri;
      return index === 0 ? text.replace(/\/+$/, '') : text.replace(/^\/+|\/+$/g, '');
    })
    .join('/');
}

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///fake/cache/' } },
  File: class MockFile {
    private location: string;
    constructor(...parts: readonly (string | { readonly uri: string })[]) {
      this.location = mockJoinUri(parts);
    }
    get uri(): string {
      return this.location;
    }
    get exists(): boolean {
      return mockFileStore.has(this.location);
    }
    async bytes(): Promise<Uint8Array> {
      mockFileOps.push(`bytes ${this.location}`);
      const content = mockFileStore.get(this.location);
      if (!content) throw new Error('missing file');
      return content;
    }
    write(content: Uint8Array): void {
      mockFileOps.push(`write ${this.location}`);
      if (mockWriteError) throw mockWriteError;
      mockFileStore.set(this.location, content);
    }
    delete(): void {
      mockFileOps.push(`delete ${this.location}`);
      if (mockDeleteError) throw mockDeleteError;
      mockFileStore.delete(this.location);
    }
    move(destination: { readonly uri: string }): void {
      mockFileOps.push(`move ${this.location} -> ${destination.uri}`);
      if (mockMoveFailure && !mockMoveFailure.afterMoving) throw mockMoveFailure.error;
      const content = mockFileStore.get(this.location);
      const parent = destination.uri.slice(0, destination.uri.lastIndexOf('/') + 1);
      if (!content || !mockDirectories.has(parent)) throw new Error('cannot move');
      mockFileStore.delete(this.location);
      mockFileStore.set(destination.uri, content);
      this.location = destination.uri;
      if (mockMoveFailure) throw mockMoveFailure.error;
    }
  },
  Directory: class MockDirectory {
    readonly uri: string;
    constructor(...parts: readonly (string | { readonly uri: string })[]) {
      this.uri = `${mockJoinUri(parts)}/`;
    }
    get exists(): boolean {
      return mockDirectories.has(this.uri);
    }
    create(options?: unknown): void {
      mockFileOps.push(`mkdir ${this.uri}`);
      mockMkdirOptions.push(options);
      if (mockMkdirError) throw mockMkdirError;
      mockDirectories.add(this.uri);
    }
    list(): { readonly uri: string }[] {
      return [...mockFileStore.keys()].filter((key) => key.startsWith(this.uri)).map((uri) => ({ uri }));
    }
    delete(): void {
      mockFileOps.push(`rmdir ${this.uri}`);
      if (mockRmdirError) throw mockRmdirError;
      if (!mockDirectories.has(this.uri)) throw new Error('missing directory');
      for (const key of [...mockFileStore.keys()]) {
        if (key.startsWith(this.uri)) mockFileStore.delete(key);
      }
      mockDirectories.delete(this.uri);
    }
  },
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ getRandomValues: jest.fn(), randomUUID: jest.fn() }));
jest.mock('./secureRandom', () => ({ installSecureRandom: jest.fn() }));
jest.mock('./encryptPdfBytes', () => ({ encryptPdfBytes: jest.fn() }));

const printToFileAsync = jest.mocked(Print.printToFileAsync);
const encrypt = jest.mocked(encryptPdfBytes);
const install = jest.mocked(installSecureRandom);
const uuid = jest.mocked(randomUUID);

const PLAIN_URI = 'file:///fake/cache/Print/recibo.pdf';
const PLAIN_BYTES = new Uint8Array([1, 2, 3]);
const ENCRYPTED_BYTES = new Uint8Array([9, 9, 9, 9]);
const PASSWORD = '00000000T';
const UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_UUID = '11111111-2222-4333-8444-555555555555';
const FILE_NAME = 'AnaPruebaEjemplo-NominaOctubre2026';
const DIR_URI = `file:///fake/cache/receipts/${UUID}/`;
const NAMED_URI = `${DIR_URI}${FILE_NAME}.pdf`;

describe('ExpoPrintReceiptGenerator', () => {
  beforeEach(() => {
    printToFileAsync.mockReset();
    printToFileAsync.mockResolvedValue({ uri: PLAIN_URI, numberOfPages: 1 });
    encrypt.mockReset();
    encrypt.mockResolvedValue(ENCRYPTED_BYTES);
    install.mockReset();
    uuid.mockReset();
    uuid.mockReturnValue(UUID);
    mockFileStore.clear();
    mockFileStore.set(PLAIN_URI, PLAIN_BYTES);
    mockDirectories.clear();
    mockFileOps.length = 0;
    mockMkdirOptions.length = 0;
    mockDeleteError = null;
    mockWriteError = null;
    mockMkdirError = null;
    mockRmdirError = null;
    mockMoveFailure = null;
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

  describe('with a readable file name (spec R11-R13)', () => {
    it('moves the printed file into a fresh receipts/<uuid>/ directory under the requested name', async () => {
      const generator = new ExpoPrintReceiptGenerator();

      const result = await generator.generate('<html></html>', { fileName: FILE_NAME });

      expect(result).toEqual({ uri: NAMED_URI });
      expect(mockFileOps).toEqual([`mkdir ${DIR_URI}`, `move ${PLAIN_URI} -> ${NAMED_URI}`]);
      expect(mockMkdirOptions).toEqual([{ intermediates: true }]);
      expect(mockFileStore.get(NAMED_URI)).toBe(PLAIN_BYTES);
      expect(mockFileStore.has(PLAIN_URI)).toBe(false);
      expect(encrypt).not.toHaveBeenCalled();
    });

    it('uses a new directory per call, so the same name never collides', async () => {
      const generator = new ExpoPrintReceiptGenerator();
      uuid.mockReturnValueOnce(UUID).mockReturnValueOnce(OTHER_UUID);

      const first = await generator.generate('<html></html>', { fileName: FILE_NAME });
      mockFileStore.set(PLAIN_URI, PLAIN_BYTES);
      const second = await generator.generate('<html></html>', { fileName: FILE_NAME });

      expect(first.uri).toBe(NAMED_URI);
      expect(second.uri).toBe(`file:///fake/cache/receipts/${OTHER_UUID}/${FILE_NAME}.pdf`);
      expect(mockFileStore.has(first.uri)).toBe(true);
      expect(mockFileStore.has(second.uri)).toBe(true);
    });

    it('moves BEFORE encrypting and writes the encrypted bytes at the final uri', async () => {
      const generator = new ExpoPrintReceiptGenerator();

      const result = await generator.generate('<html></html>', { fileName: FILE_NAME, password: PASSWORD });

      expect(result).toEqual({ uri: NAMED_URI });
      expect(mockFileOps).toEqual([
        `mkdir ${DIR_URI}`,
        `move ${PLAIN_URI} -> ${NAMED_URI}`,
        `bytes ${NAMED_URI}`,
        `write ${NAMED_URI}`,
      ]);
      expect(encrypt).toHaveBeenCalledWith(PLAIN_BYTES, PASSWORD);
      expect(mockFileStore.get(NAMED_URI)).toBe(ENCRYPTED_BYTES);
      expect(mockFileStore.has(PLAIN_URI)).toBe(false);
    });

    it.each([
      ['an empty name', ''],
      ['a path traversal', '../evil'],
      ['a separator', 'a/b'],
      ['a space', 'a b'],
      ['a non-ASCII letter', 'Peña'],
      ['an extension', 'a.pdf'],
      ['101 characters', 'A'.repeat(101)],
    ])('ignores %s and touches no file', async (_label, fileName) => {
      const generator = new ExpoPrintReceiptGenerator();

      const result = await generator.generate('<html></html>', { fileName });

      expect(result).toEqual({ uri: PLAIN_URI });
      expect(mockFileOps).toEqual([]);
      expect(uuid).not.toHaveBeenCalled();
      expect(mockFileStore.get(PLAIN_URI)).toBe(PLAIN_BYTES);
    });

    it('still encrypts at the printed uri when the name is unsafe', async () => {
      const generator = new ExpoPrintReceiptGenerator();

      const result = await generator.generate('<html></html>', { fileName: '../evil', password: PASSWORD });

      expect(result).toEqual({ uri: PLAIN_URI });
      expect(mockFileOps).toEqual([`bytes ${PLAIN_URI}`, `write ${PLAIN_URI}`]);
      expect(mockFileStore.get(PLAIN_URI)).toBe(ENCRYPTED_BYTES);
    });

    describe('when naming fails', () => {
      it('returns the printed uri without rejecting when the directory cannot be created', async () => {
        mockMkdirError = new Error('read-only');
        const generator = new ExpoPrintReceiptGenerator();

        const result = await generator.generate('<html></html>', { fileName: FILE_NAME });

        expect(result).toEqual({ uri: PLAIN_URI });
        expect(mockFileOps).toEqual([`mkdir ${DIR_URI}`]);
        expect(mockFileStore.get(PLAIN_URI)).toBe(PLAIN_BYTES);
      });

      it('returns the printed uri and removes the empty directory when the move fails', async () => {
        mockMoveFailure = { error: new Error('cannot move'), afterMoving: false };
        const generator = new ExpoPrintReceiptGenerator();

        const result = await generator.generate('<html></html>', { fileName: FILE_NAME });

        expect(result).toEqual({ uri: PLAIN_URI });
        expect(mockFileOps).toEqual([`mkdir ${DIR_URI}`, `move ${PLAIN_URI} -> ${NAMED_URI}`, `rmdir ${DIR_URI}`]);
        expect(mockDirectories.has(DIR_URI)).toBe(false);
        expect(mockFileStore.get(PLAIN_URI)).toBe(PLAIN_BYTES);
      });

      it('still encrypts at the printed uri when the move fails', async () => {
        mockMoveFailure = { error: new Error('cannot move'), afterMoving: false };
        const generator = new ExpoPrintReceiptGenerator();

        const result = await generator.generate('<html></html>', { fileName: FILE_NAME, password: PASSWORD });

        expect(result).toEqual({ uri: PLAIN_URI });
        expect(mockFileStore.get(PLAIN_URI)).toBe(ENCRYPTED_BYTES);
        expect(mockFileStore.has(NAMED_URI)).toBe(false);
      });

      it('still encrypts at the printed uri when the directory cannot be created', async () => {
        mockMkdirError = new Error('read-only');
        const generator = new ExpoPrintReceiptGenerator();

        const result = await generator.generate('<html></html>', { fileName: FILE_NAME, password: PASSWORD });

        expect(result).toEqual({ uri: PLAIN_URI });
        expect(encrypt).toHaveBeenCalledWith(PLAIN_BYTES, PASSWORD);
        expect(mockFileStore.get(PLAIN_URI)).toBe(ENCRYPTED_BYTES);
      });

      it('returns the target when the move completed and then threw', async () => {
        mockMoveFailure = { error: new Error('late failure'), afterMoving: true };
        const generator = new ExpoPrintReceiptGenerator();

        const result = await generator.generate('<html></html>', { fileName: FILE_NAME, password: PASSWORD });

        expect(result).toEqual({ uri: NAMED_URI });
        expect(mockFileStore.get(NAMED_URI)).toBe(ENCRYPTED_BYTES);
        expect(mockFileStore.has(PLAIN_URI)).toBe(false);
        expect(mockFileOps).not.toContain(`rmdir ${DIR_URI}`);
      });

      it('never removes a directory that still holds a file', async () => {
        mockMoveFailure = { error: new Error('cannot move'), afterMoving: false };
        mockFileStore.set(`${DIR_URI}stray.pdf`, PLAIN_BYTES);
        mockDirectories.add(DIR_URI);
        mockMkdirError = new Error('already exists');
        const generator = new ExpoPrintReceiptGenerator();

        await generator.generate('<html></html>', { fileName: FILE_NAME });

        expect(mockFileOps).not.toContain(`rmdir ${DIR_URI}`);
        expect(mockFileStore.has(`${DIR_URI}stray.pdf`)).toBe(true);
      });
    });

    describe('when encryption fails after the move (spec S11.4)', () => {
      it('deletes the moved file and its now-empty directory, then rejects with the fixed error', async () => {
        encrypt.mockRejectedValue(new Error('lib exploded'));
        const generator = new ExpoPrintReceiptGenerator();

        let failure: unknown = null;
        await generator.generate('<html></html>', { fileName: FILE_NAME, password: PASSWORD }).catch((error: unknown) => {
          failure = error;
        });

        expect((failure as Error).message).toBe('Receipt encryption failed');
        expect(mockFileOps).toContain(`delete ${NAMED_URI}`);
        expect(mockFileOps).toContain(`rmdir ${DIR_URI}`);
        expect(mockFileStore.has(NAMED_URI)).toBe(false);
        expect(mockDirectories.has(DIR_URI)).toBe(false);
      });

      it('leaves a previous generation untouched', async () => {
        const previous = `file:///fake/cache/receipts/${OTHER_UUID}/Previous.pdf`;
        mockFileStore.set(previous, PLAIN_BYTES);
        mockDirectories.add(`file:///fake/cache/receipts/${OTHER_UUID}/`);
        encrypt.mockRejectedValue(new Error('lib exploded'));
        const generator = new ExpoPrintReceiptGenerator();

        await generator.generate('<html></html>', { fileName: FILE_NAME, password: PASSWORD }).catch(() => undefined);

        expect(mockFileStore.get(previous)).toBe(PLAIN_BYTES);
        expect(mockDirectories.has(`file:///fake/cache/receipts/${OTHER_UUID}/`)).toBe(true);
      });

      it('still rejects with the fixed error when removing the directory also fails', async () => {
        encrypt.mockRejectedValue(new Error('lib exploded'));
        mockRmdirError = new Error('cannot remove');
        const generator = new ExpoPrintReceiptGenerator();

        let failure: unknown = null;
        await generator.generate('<html></html>', { fileName: FILE_NAME, password: PASSWORD }).catch((error: unknown) => {
          failure = error;
        });

        expect((failure as Error).message).toBe('Receipt encryption failed');
      });
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

    describe('receipts/<uuid>/ tidy-up (spec R14, design D5)', () => {
      beforeEach(() => {
        mockFileStore.set(NAMED_URI, PLAIN_BYTES);
        mockDirectories.add(DIR_URI);
      });

      it('deletes the file and then its now-empty uuid directory', async () => {
        const generator = new ExpoPrintReceiptGenerator();

        await generator.discard(NAMED_URI);

        expect(mockFileOps).toEqual([`delete ${NAMED_URI}`, `rmdir ${DIR_URI}`]);
        expect(mockFileStore.has(NAMED_URI)).toBe(false);
        expect(mockDirectories.has(DIR_URI)).toBe(false);
      });

      it('keeps the directory when another file still lives in it (the delete is recursive)', async () => {
        mockFileStore.set(`${DIR_URI}sibling.pdf`, PLAIN_BYTES);
        const generator = new ExpoPrintReceiptGenerator();

        await generator.discard(NAMED_URI);

        expect(mockFileOps).toEqual([`delete ${NAMED_URI}`]);
        expect(mockFileStore.has(`${DIR_URI}sibling.pdf`)).toBe(true);
        expect(mockDirectories.has(DIR_URI)).toBe(true);
      });

      it.each([
        ['a parent that is not a uuid', 'file:///fake/cache/receipts/not-a-uuid/Name.pdf'],
        ['a parent directly under the cache', `file:///fake/cache/${UUID}/Name.pdf`],
        ['a different top-level directory', `file:///fake/cache/other/${UUID}/Name.pdf`],
        ['a nested sub-directory', `file:///fake/cache/receipts/${UUID}/sub/Name.pdf`],
        ['the receipts directory itself', 'file:///fake/cache/receipts/Name.pdf'],
      ])('deletes the file but never a directory for %s', async (_label, uri) => {
        mockFileStore.set(uri, PLAIN_BYTES);
        const generator = new ExpoPrintReceiptGenerator();

        await generator.discard(uri);

        expect(mockFileOps).toEqual([`delete ${uri}`]);
        expect(mockFileStore.has(uri)).toBe(false);
      });

      it('never throws when removing the directory fails', async () => {
        mockRmdirError = new Error('cannot remove');
        const generator = new ExpoPrintReceiptGenerator();

        await expect(generator.discard(NAMED_URI)).resolves.toBeUndefined();
        expect(mockFileOps).toContain(`rmdir ${DIR_URI}`);
        expect(mockFileStore.has(NAMED_URI)).toBe(false);
      });

      it('keeps the directory when deleting the file throws, because it is no longer empty', async () => {
        mockDeleteError = new Error('cannot delete');
        const generator = new ExpoPrintReceiptGenerator();

        await expect(generator.discard(NAMED_URI)).resolves.toBeUndefined();
        expect(mockFileStore.has(NAMED_URI)).toBe(true);
        expect(mockFileOps).not.toContain(`rmdir ${DIR_URI}`);
      });
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
