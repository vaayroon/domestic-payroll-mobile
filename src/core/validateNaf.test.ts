import { validateNaf } from './validateNaf';

// All NAF values below are obviously-fake structural test vectors
// (CLAUDE.md §6) — the ADR fallback in validateNaf.ts ships structural-only
// validation, so no control-digit checksum is exercised here.
describe('validateNaf', () => {
  it('accepts an empty string as valid null (field is optional)', () => {
    expect(validateNaf('')).toEqual({ ok: true, value: null });
  });

  it('accepts an all-whitespace string as valid null', () => {
    expect(validateNaf('   ')).toEqual({ ok: true, value: null });
  });

  it('accepts 11 digits', () => {
    expect(validateNaf('28000000000')).toEqual({ ok: true, value: '28000000000' });
  });

  it('accepts 12 digits', () => {
    expect(validateNaf('280000000000')).toEqual({ ok: true, value: '280000000000' });
  });

  it('strips spaces, slashes, and dashes before checking length', () => {
    expect(validateNaf('28 000000 000')).toEqual({ ok: true, value: '28000000000' });
    expect(validateNaf('28/00000000-0')).toEqual({ ok: true, value: '28000000000' });
  });

  it('rejects fewer than 11 digits', () => {
    expect(validateNaf('2800000000')).toEqual({ ok: false, error: 'invalid_format' });
  });

  it('rejects more than 12 digits', () => {
    expect(validateNaf('2800000000000')).toEqual({ ok: false, error: 'invalid_format' });
  });

  it('rejects non-numeric characters', () => {
    expect(validateNaf('28ABCDEFGH1')).toEqual({ ok: false, error: 'invalid_format' });
  });
});
