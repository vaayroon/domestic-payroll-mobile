import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from './testing/fixtures';
import {
  MAX_SIGNATURE_BASE64_LENGTH,
  NO_EMPLOYER_SIGNATURE,
  parseEmployerSignature,
  serializeEmployerSignature,
  type EmployerSignature,
} from './employerSignature';

describe('parseEmployerSignature', () => {
  it('round-trips a valid signature through serialize/parse', () => {
    const signature: EmployerSignature = { pngBase64: SYNTHETIC_SIGNATURE_PNG_BASE64, updatedAt: 1700000000000 };

    const result = parseEmployerSignature(serializeEmployerSignature(signature));

    expect(result).toEqual(signature);
  });

  it('round-trips a cleared envelope', () => {
    const cleared: EmployerSignature = { pngBase64: null, updatedAt: 1700000000000 };

    const result = parseEmployerSignature(serializeEmployerSignature(cleared));

    expect(result).toEqual(cleared);
  });

  it('missing key (null) falls back to NO_EMPLOYER_SIGNATURE', () => {
    expect(parseEmployerSignature(null)).toEqual(NO_EMPLOYER_SIGNATURE);
  });

  it('corrupt JSON falls back without throwing', () => {
    expect(() => parseEmployerSignature('{not valid json')).not.toThrow();
    expect(parseEmployerSignature('{not valid json')).toEqual(NO_EMPLOYER_SIGNATURE);
  });

  it('wrong shape (missing fields) falls back to NO_EMPLOYER_SIGNATURE', () => {
    expect(parseEmployerSignature('{}')).toEqual(NO_EMPLOYER_SIGNATURE);
    expect(parseEmployerSignature('[1,2,3]')).toEqual(NO_EMPLOYER_SIGNATURE);
    expect(parseEmployerSignature('"just a string"')).toEqual(NO_EMPLOYER_SIGNATURE);
  });

  it('non-string pngBase64 falls back to NO_EMPLOYER_SIGNATURE', () => {
    expect(parseEmployerSignature('{"pngBase64":12345,"updatedAt":1}')).toEqual(NO_EMPLOYER_SIGNATURE);
    expect(parseEmployerSignature('{"pngBase64":true,"updatedAt":1}')).toEqual(NO_EMPLOYER_SIGNATURE);
  });

  it('rejects a full data: URL (bad charset)', () => {
    const dataUrl = `data:image/png;base64,${SYNTHETIC_SIGNATURE_PNG_BASE64}`;
    expect(parseEmployerSignature(JSON.stringify({ pngBase64: dataUrl, updatedAt: 1 }))).toEqual(
      NO_EMPLOYER_SIGNATURE,
    );
  });

  it('rejects a payload with the wrong magic prefix', () => {
    const wrongMagic = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    expect(parseEmployerSignature(JSON.stringify({ pngBase64: wrongMagic, updatedAt: 1 }))).toEqual(
      NO_EMPLOYER_SIGNATURE,
    );
  });

  it('rejects a payload whose length is not a multiple of 4', () => {
    const notMod4 = `${PNG_MAGIC_PREFIXED_VALID_SAMPLE}A`;
    expect(parseEmployerSignature(JSON.stringify({ pngBase64: notMod4, updatedAt: 1 }))).toEqual(
      NO_EMPLOYER_SIGNATURE,
    );
  });

  it('rejects an oversized payload (MAX + 1)', () => {
    const oversized = 'iVBORw0K' + 'A'.repeat(MAX_SIGNATURE_BASE64_LENGTH - 8 + 4);
    expect(oversized.length).toBe(MAX_SIGNATURE_BASE64_LENGTH + 4);
    expect(parseEmployerSignature(JSON.stringify({ pngBase64: oversized, updatedAt: 1 }))).toEqual(
      NO_EMPLOYER_SIGNATURE,
    );
  });

  it('accepts a payload at exactly the size boundary (MAX)', () => {
    const boundary = 'iVBORw0K' + 'A'.repeat(MAX_SIGNATURE_BASE64_LENGTH - 8);
    expect(boundary.length).toBe(MAX_SIGNATURE_BASE64_LENGTH);
    const signature: EmployerSignature = { pngBase64: boundary, updatedAt: 1 };
    expect(parseEmployerSignature(serializeEmployerSignature(signature))).toEqual(signature);
  });
});

describe('serializeEmployerSignature', () => {
  it('serializes a valid value as JSON', () => {
    const signature: EmployerSignature = { pngBase64: SYNTHETIC_SIGNATURE_PNG_BASE64, updatedAt: 1700000000000 };

    expect(serializeEmployerSignature(signature)).toBe(JSON.stringify(signature));
  });

  it('throws a fixed RangeError message on an invalid payload -- never echoing the payload', () => {
    const invalid: EmployerSignature = { pngBase64: 'not-base64-!!!', updatedAt: 1 };

    expect(() => serializeEmployerSignature(invalid)).toThrow(RangeError);
    try {
      serializeEmployerSignature(invalid);
      throw new Error('expected serializeEmployerSignature to throw');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      expect(message).toBe('Invalid EmployerSignature: payload is not a bounded base64 PNG.');
      expect(message).not.toContain(SYNTHETIC_SIGNATURE_PNG_BASE64);
    }
  });

  it('throws on an oversized payload without echoing it', () => {
    const oversized = 'iVBORw0K' + 'A'.repeat(MAX_SIGNATURE_BASE64_LENGTH - 8 + 4);
    const invalid: EmployerSignature = { pngBase64: oversized, updatedAt: 1 };

    expect(() => serializeEmployerSignature(invalid)).toThrow(RangeError);
    try {
      serializeEmployerSignature(invalid);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      expect(message).not.toContain(oversized);
    }
  });

  it('throws when the payload length is not a multiple of 4', () => {
    const invalid: EmployerSignature = { pngBase64: `${PNG_MAGIC_PREFIXED_VALID_SAMPLE}A`, updatedAt: 1 };
    expect(() => serializeEmployerSignature(invalid)).toThrow(RangeError);
  });

  it('throws when updatedAt is missing or not a finite number', () => {
    expect(() =>
      serializeEmployerSignature({ pngBase64: null, updatedAt: Number.NaN } as EmployerSignature),
    ).toThrow(RangeError);
  });
});

/** A syntactically valid base64 sample (charset + magic ok), length % 4 === 0, used as a base for negative mutation tests above. */
const PNG_MAGIC_PREFIXED_VALID_SAMPLE = 'iVBORw0KAAAA';
