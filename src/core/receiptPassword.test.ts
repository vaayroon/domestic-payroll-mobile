import {
  isReceiptPasswordWritable,
  RECEIPT_PASSWORD_MAX_LENGTH,
  resolveReceiptPassword,
  validateReceiptPasswordOverride,
} from './receiptPassword';
import { normalizeIdentityDocument } from './validateNifNie';

// Placeholders only (CLAUDE.md §6): 00000000T and X0000000T.
describe('normalizeIdentityDocument', () => {
  it('trims, uppercases and strips spaces and hyphens', () => {
    expect(normalizeIdentityDocument(' 00000000-t ')).toBe('00000000T');
    expect(normalizeIdentityDocument('x 0000000 - t')).toBe('X0000000T');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeIdentityDocument('   ')).toBe('');
  });
});

describe('RECEIPT_PASSWORD_MAX_LENGTH', () => {
  it('is the AES-128 / R4 limit: the writer truncates silently after 32 characters', () => {
    expect(RECEIPT_PASSWORD_MAX_LENGTH).toBe(32);
  });
});

describe('resolveReceiptPassword', () => {
  it('derives the password from the NIF, normalized (spec R1 S1)', () => {
    expect(resolveReceiptPassword({ nif: ' 00000000-t ', receiptPasswordOverride: null })).toEqual({
      ok: true,
      password: '00000000T',
      source: 'document',
    });
  });

  it('keeps the NIE prefix letter, for X, Y and Z (spec R1 S2)', () => {
    expect(resolveReceiptPassword({ nif: 'x0000000t', receiptPasswordOverride: null })).toEqual({
      ok: true,
      password: 'X0000000T',
      source: 'document',
    });
    expect(resolveReceiptPassword({ nif: 'y0000000t', receiptPasswordOverride: null })).toMatchObject({
      password: 'Y0000000T',
    });
    expect(resolveReceiptPassword({ nif: 'z0000000t', receiptPasswordOverride: null })).toMatchObject({
      password: 'Z0000000T',
    });
  });

  it('prefers the override and never replaces it with the NIF (spec R1 S3)', () => {
    expect(resolveReceiptPassword({ nif: '00000000T', receiptPasswordOverride: 'clave 1' })).toEqual({
      ok: true,
      password: 'clave 1',
      source: 'override',
    });
  });

  it('trims a stored override the same way validation does', () => {
    expect(resolveReceiptPassword({ nif: null, receiptPasswordOverride: '  clave 1 ' })).toEqual({
      ok: true,
      password: 'clave 1',
      source: 'override',
    });
  });

  it('is unavailable with no document and no override (spec R1 S4)', () => {
    expect(resolveReceiptPassword({ nif: null, receiptPasswordOverride: null })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(resolveReceiptPassword({ nif: '   ', receiptPasswordOverride: null })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('falls back to the document when the stored override is blank', () => {
    expect(resolveReceiptPassword({ nif: '00000000T', receiptPasswordOverride: '   ' })).toMatchObject({
      ok: true,
      source: 'document',
    });
  });

  it('is unavailable, not a fallback to the NIF, when the stored override is invalid (fail closed)', () => {
    expect(resolveReceiptPassword({ nif: '00000000T', receiptPasswordOverride: 'contraseña' })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(resolveReceiptPassword({ nif: '00000000T', receiptPasswordOverride: 'a'.repeat(33) })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('is unavailable when the stored document could not be written or read back as a password', () => {
    expect(resolveReceiptPassword({ nif: 'X000000Ñ', receiptPasswordOverride: null })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(resolveReceiptPassword({ nif: '0'.repeat(33), receiptPasswordOverride: null })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});

describe('validateReceiptPasswordOverride', () => {
  it('maps blank input to null (spec R2 S1)', () => {
    expect(validateReceiptPasswordOverride('')).toEqual({ ok: true, value: null });
    expect(validateReceiptPasswordOverride('   ')).toEqual({ ok: true, value: null });
  });

  it('trims and keeps inner spaces and punctuation', () => {
    expect(validateReceiptPasswordOverride('  clave 1! ')).toEqual({ ok: true, value: 'clave 1!' });
  });

  it('accepts exactly 32 characters and rejects 33 as too_long (spec R2 S2)', () => {
    expect(validateReceiptPasswordOverride('a'.repeat(32))).toEqual({ ok: true, value: 'a'.repeat(32) });
    expect(validateReceiptPasswordOverride('a'.repeat(33))).toEqual({ ok: false, error: 'too_long' });
  });

  it('measures the length after trimming', () => {
    expect(validateReceiptPasswordOverride(` ${'a'.repeat(32)} `)).toEqual({ ok: true, value: 'a'.repeat(32) });
  });

  it('accepts the whole printable ASCII range', () => {
    const printable = Array.from({ length: 0x7e - 0x20 + 1 }, (_unused, index) => String.fromCharCode(0x20 + index));
    // Trimming removes a leading/trailing space, so test the inner characters.
    const value = `x${printable.join('')}x`.slice(0, RECEIPT_PASSWORD_MAX_LENGTH);
    expect(validateReceiptPasswordOverride(value)).toEqual({ ok: true, value });
    expect(validateReceiptPasswordOverride('~')).toEqual({ ok: true, value: '~' });
  });

  it.each([
    ['an accented letter (writer Latin-1, viewer UTF-8: would not open)', 'contraseña'],
    ['another Latin-1 character', 'café'],
    ['the euro sign (the writer would throw)', 'clave€'],
    ['a control character (spec R2 S4)', 'a\u0007b'],
    ['a tab', 'a\tb'],
    ['DEL', 'a\u007fb'],
    ['a C1 control', 'a\u0085b'],
    ['an emoji (surrogate pair)', 'clave\u{1F600}'],
    ['a lone surrogate', '\uD800'],
  ])('rejects %s as invalid_characters', (_label, raw) => {
    expect(validateReceiptPasswordOverride(raw)).toEqual({ ok: false, error: 'invalid_characters' });
  });

  it('reports invalid_characters before too_long when both apply', () => {
    expect(validateReceiptPasswordOverride(`${'ñ'.repeat(40)}`)).toEqual({ ok: false, error: 'invalid_characters' });
  });
});

describe('isReceiptPasswordWritable', () => {
  it.each([
    ['a document', '00000000T'],
    ['a single character', 'a'],
    ['exactly 32 characters', 'a'.repeat(32)],
    ['printable ASCII bounds, space and tilde', ' ~'],
    ['inner and outer spaces, taken verbatim', ' clave 1 '],
  ])('accepts %s', (_label, candidate) => {
    expect(isReceiptPasswordWritable(candidate)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['33 characters (the writer would silently truncate)', 'a'.repeat(33)],
    ['a Latin-1 accent (one byte for the writer, two for the viewer)', 'clavé'],
    ['n with tilde', 'añejo'],
    ['above U+00FF (the writer throws)', 'clave€'],
    ['a control character', 'cla\tve'],
    ['DEL', 'cla\u007Fve'],
    ['an emoji (surrogate pair)', 'clave\u{1F600}'],
  ])('rejects %s', (_label, candidate) => {
    expect(isReceiptPasswordWritable(candidate)).toBe(false);
  });
});
