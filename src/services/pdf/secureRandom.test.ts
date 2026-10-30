/**
 * Tests for the secure-random shim (design D3). Hermes has no `crypto` global
 * and `@cantoo/pdf-lib` silently falls back to `Math.random` for per-string IVs
 * when it is missing, so the adapter installs a `getRandomValues` backed by an
 * INJECTED source (expo-crypto on device, `node:crypto` here) and refuses to
 * encrypt without it.
 */

import { randomFillSync } from 'node:crypto';

import { assertSecureRandom, installSecureRandom } from './secureRandom';

const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

function removeGlobalCrypto(): void {
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
}

const nodeRandomSource = (array: Uint8Array): Uint8Array => randomFillSync(array);

afterEach(() => {
  if (cryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'crypto');
  }
});

describe('installSecureRandom', () => {
  it('installs a getRandomValues backed by the injected source when crypto is absent', () => {
    removeGlobalCrypto();
    const source = jest.fn(nodeRandomSource);

    installSecureRandom(source);

    const bytes = new Uint8Array(32);
    const returned = globalThis.crypto.getRandomValues(bytes);
    expect(returned).toBe(bytes);
    expect(bytes.some((byte) => byte !== 0)).toBe(true);
    // 1 self-test call + 1 call from this test.
    expect(source).toHaveBeenCalledTimes(2);
    expect(source).toHaveBeenLastCalledWith(bytes);
  });

  it('is a no-op and never calls the source when getRandomValues already exists', () => {
    const existing = { getRandomValues: jest.fn((array: Uint8Array) => array) };
    Object.defineProperty(globalThis, 'crypto', { value: existing, configurable: true, writable: true });
    const source = jest.fn(nodeRandomSource);

    installSecureRandom(source);

    expect(globalThis.crypto).toBe(existing);
    expect(source).not.toHaveBeenCalled();
  });

  it('replaces a crypto object that has no getRandomValues function', () => {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true, writable: true });

    installSecureRandom(nodeRandomSource);

    expect(typeof globalThis.crypto.getRandomValues).toBe('function');
  });

  it('is idempotent: a second install keeps the first shim', () => {
    removeGlobalCrypto();
    installSecureRandom(nodeRandomSource);
    const first = globalThis.crypto;

    const secondSource = jest.fn(nodeRandomSource);
    installSecureRandom(secondSource);

    expect(globalThis.crypto).toBe(first);
    expect(secondSource).not.toHaveBeenCalled();
  });

  it('throws a fixed error and leaves no shim behind when the source throws', () => {
    removeGlobalCrypto();
    const failing = (): Uint8Array => {
      throw new Error('native module exploded');
    };

    expect(() => installSecureRandom(failing)).toThrow('Secure random source unavailable');
    expect(() => assertSecureRandom()).toThrow('Secure random source unavailable');
  });

  it('rejects a source that leaves the buffer all zeros (self-test)', () => {
    removeGlobalCrypto();
    const zeroSource = (array: Uint8Array): Uint8Array => array;

    expect(() => installSecureRandom(zeroSource)).toThrow('Secure random source unavailable');
    expect(() => assertSecureRandom()).toThrow('Secure random source unavailable');
  });
});

describe('assertSecureRandom', () => {
  it('throws when no getRandomValues is available', () => {
    removeGlobalCrypto();

    expect(() => assertSecureRandom()).toThrow('Secure random source unavailable');
  });

  it('does not throw once a source is installed', () => {
    removeGlobalCrypto();
    installSecureRandom(nodeRandomSource);

    expect(() => assertSecureRandom()).not.toThrow();
  });
});
