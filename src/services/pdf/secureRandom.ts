/**
 * Secure-random shim for the receipt encryptor (design D3).
 *
 * Hermes has no `crypto` global. `@cantoo/pdf-lib` reads
 * `globalThis.crypto.getRandomValues` for the file key, salts and `/ID`, and
 * throws when it is missing, BUT its per-string IV generation
 * (`CipherTransform.encryptString`) checks a bare `typeof crypto` and silently
 * falls back to `Math.random()`. A weak IV must never reach a receipt, so the
 * adapter installs a `getRandomValues` backed by an injected, cryptographically
 * secure source (expo-crypto on device, `node:crypto` in Jest) and asserts it
 * is present before every encryption.
 *
 * The install is lazy, idempotent and never overwrites an existing
 * `getRandomValues`, so it cannot disturb any other consumer of the global.
 */

/** Fills the given bytes with cryptographically secure random values. */
export type RandomValuesSource = (array: Uint8Array) => Uint8Array;

const UNAVAILABLE_MESSAGE = 'Secure random source unavailable';
const SELF_TEST_BYTES = 16;

function hasGetRandomValues(): boolean {
  const candidate: unknown = (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof (candidate as { getRandomValues?: unknown }).getRandomValues === 'function'
  );
}

/** Throws unless a `crypto.getRandomValues` is installed. Never falls back to `Math.random`. */
export function assertSecureRandom(): void {
  if (!hasGetRandomValues()) {
    throw new Error(UNAVAILABLE_MESSAGE);
  }
}

/**
 * Installs `globalThis.crypto.getRandomValues` backed by `source` when (and only
 * when) none exists, then self-tests it. If the self-test fails the shim is
 * removed again and a fixed error is thrown (no source detail is propagated).
 */
export function installSecureRandom(source: RandomValuesSource): void {
  if (hasGetRandomValues()) {
    return;
  }

  const getRandomValues = (array: Uint8Array): Uint8Array => source(array);
  Object.defineProperty(globalThis, 'crypto', {
    value: { getRandomValues },
    configurable: true,
    writable: true,
  });

  try {
    const probe = new Uint8Array(SELF_TEST_BYTES);
    const filled = getRandomValues(probe);
    if (filled !== probe || !probe.some((byte) => byte !== 0)) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }
  } catch {
    Reflect.deleteProperty(globalThis, 'crypto');
    throw new Error(UNAVAILABLE_MESSAGE);
  }
}
