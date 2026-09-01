/**
 * Codec for the employer's saved signature (design ADR-3). Pure -- no I/O,
 * no clock read internally -- persisted as a single JSON blob under
 * `SettingsRepository` key `EMPLOYER_SIGNATURE_KEY` (decision: reuse the
 * existing key/value settings table, no new Drizzle migration).
 *
 * Lives in `core/` rather than a feature folder because it has two
 * consumers in two different features: the employer settings hook (write)
 * and the payroll receipt generator (read). See design ADR-3 for the full
 * rationale, mirroring the precedent of `parseEuroInput`/`validateNifNie`/
 * `validateNaf` (`core/index.ts`).
 */

export const EMPLOYER_SIGNATURE_KEY = 'employer.signature';

export interface EmployerSignature {
  /** Bare base64 PNG payload, NO `data:` prefix. `null` = explicitly cleared, or never set. */
  readonly pngBase64: string | null;
  /** Epoch ms of the last write. `0` when never set. */
  readonly updatedAt: number;
}

export const NO_EMPLOYER_SIGNATURE: EmployerSignature = { pngBase64: null, updatedAt: 0 };

/** 256 KiB of base64 characters. See the size-cap rationale in the design (ADR-3). */
export const MAX_SIGNATURE_BASE64_LENGTH = 256 * 1024;

/** Base64 of the first 6 bytes of the PNG 8-byte file signature (89 50 4E 47 0D 0A). */
const PNG_BASE64_MAGIC = 'iVBORw0K';

const BASE64_CHARSET_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Structural + charset validation for a non-null payload string. */
function isValidSignaturePayload(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_SIGNATURE_BASE64_LENGTH &&
    value.length % 4 === 0 &&
    BASE64_CHARSET_PATTERN.test(value) &&
    value.startsWith(PNG_BASE64_MAGIC)
  );
}

/** Structural validation shared by both parse (lenient, falls back to cleared) and serialize (strict, throws). */
function isValidEmployerSignature(value: unknown): value is EmployerSignature {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt)) {
    return false;
  }
  return candidate.pngBase64 === null || isValidSignaturePayload(candidate.pngBase64);
}

/**
 * Parses a raw `SettingsRepository.get()` value into a validated envelope.
 * Absent (`null`), corrupt JSON, wrong shape, or an invalid/oversized
 * payload NEVER throws -- it silently falls back to `NO_EMPLOYER_SIGNATURE`.
 */
export function parseEmployerSignature(raw: string | null): EmployerSignature {
  if (raw === null) {
    return NO_EMPLOYER_SIGNATURE;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NO_EMPLOYER_SIGNATURE;
  }

  return isValidEmployerSignature(parsed) ? parsed : NO_EMPLOYER_SIGNATURE;
}

/**
 * Serializes an envelope for `SettingsRepository.set()`. Unlike `parse`,
 * this is STRICT: an invalid or oversized payload throws rather than
 * silently coercing, so an invalid save never reaches persistence.
 *
 * The thrown message is a FIXED string constant with zero interpolation --
 * it MUST NEVER echo the payload (CLAUDE.md §6 / design ADR-6).
 */
export function serializeEmployerSignature(signature: EmployerSignature): string {
  if (!isValidEmployerSignature(signature)) {
    throw new RangeError('Invalid EmployerSignature: payload is not a bounded base64 PNG.');
  }
  return JSON.stringify(signature);
}
