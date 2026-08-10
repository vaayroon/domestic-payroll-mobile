import { validateNifNie } from './validateNifNie';

// Algorithmic test vectors, NOT PII (CLAUDE.md §6): 00000000T is the
// canonical mod-23 worked example (0 % 23 = 0 -> 'T'); 12345678Z is the
// standard textbook vector (12345678 % 23 = 14 -> 'Z').
describe('validateNifNie', () => {
  it('accepts an empty string as valid null (field is optional)', () => {
    expect(validateNifNie('')).toEqual({ ok: true, value: null });
  });

  it('accepts an all-whitespace string as valid null', () => {
    expect(validateNifNie('   ')).toEqual({ ok: true, value: null });
  });

  it('accepts a valid NIF (canonical worked example)', () => {
    expect(validateNifNie('00000000T')).toEqual({ ok: true, value: '00000000T' });
  });

  it('accepts a second valid NIF vector', () => {
    expect(validateNifNie('12345678Z')).toEqual({ ok: true, value: '12345678Z' });
  });

  it('normalizes lowercase letters and separators before validating', () => {
    expect(validateNifNie('12345678-z')).toEqual({ ok: true, value: '12345678Z' });
    expect(validateNifNie(' 12345678 Z ')).toEqual({ ok: true, value: '12345678Z' });
  });

  it('rejects a NIF with the wrong control letter', () => {
    expect(validateNifNie('12345678A')).toEqual({ ok: false, error: 'invalid_checksum' });
  });

  it('rejects a NIF with too few digits', () => {
    expect(validateNifNie('1234567Z')).toEqual({ ok: false, error: 'invalid_format' });
  });

  it('rejects a NIF with two trailing letters', () => {
    expect(validateNifNie('1234567AZ')).toEqual({ ok: false, error: 'invalid_format' });
  });

  it('accepts a valid NIE with X prefix', () => {
    expect(validateNifNie('X1234567L')).toEqual({ ok: true, value: 'X1234567L' });
  });

  it('accepts a valid NIE with Y prefix', () => {
    expect(validateNifNie('Y1234567X')).toEqual({ ok: true, value: 'Y1234567X' });
  });

  it('accepts a valid NIE with Z prefix', () => {
    expect(validateNifNie('Z1234567R')).toEqual({ ok: true, value: 'Z1234567R' });
  });

  it('rejects a NIE with the wrong control letter', () => {
    expect(validateNifNie('X1234567T')).toEqual({ ok: false, error: 'invalid_checksum' });
  });

  it('rejects a NIE with an invalid prefix letter', () => {
    expect(validateNifNie('W1234567L')).toEqual({ ok: false, error: 'invalid_format' });
  });

  it('rejects a CIF-shaped value (letter prefix outside X/Y/Z)', () => {
    expect(validateNifNie('B12345678')).toEqual({ ok: false, error: 'invalid_format' });
  });
});
