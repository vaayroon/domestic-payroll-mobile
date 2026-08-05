import { validateCcc } from './validateCcc';

// All CCC values below are obviously-fake structural test vectors (CLAUDE.md
// §6) — ADR-4 fallback ships structural-only validation, so no control-digit
// checksum is exercised here (see validateCcc.ts's header comment).
describe('validateCcc', () => {
  it('accepts an empty string as valid null (field is optional)', () => {
    expect(validateCcc('')).toEqual({ ok: true, value: null });
  });

  it('accepts an all-whitespace string as valid null', () => {
    expect(validateCcc('   ')).toEqual({ ok: true, value: null });
  });

  it('accepts exactly 11 digits', () => {
    expect(validateCcc('28000000000')).toEqual({ ok: true, value: '28000000000' });
  });

  it('strips spaces, slashes, and dashes before checking length', () => {
    expect(validateCcc('28 000000 000')).toEqual({ ok: true, value: '28000000000' });
    expect(validateCcc('28/00000000-0')).toEqual({ ok: true, value: '28000000000' });
  });

  it('rejects fewer than 11 digits', () => {
    expect(validateCcc('2800000000')).toEqual({ ok: false, error: 'invalid_format' });
  });

  it('rejects more than 11 digits', () => {
    expect(validateCcc('280000000000')).toEqual({ ok: false, error: 'invalid_format' });
  });

  it('rejects non-numeric characters', () => {
    expect(validateCcc('28ABCDEFGH1')).toEqual({ ok: false, error: 'invalid_format' });
  });
});
