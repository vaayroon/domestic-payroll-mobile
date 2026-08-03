import { cents } from '@/types/money';

import { parseEuroInput } from './parseEuroInput';

describe('parseEuroInput', () => {
  it('parses a dot-decimal amount', () => {
    expect(parseEuroInput('1234.56')).toEqual({ ok: true, value: cents(123456) });
  });

  it('parses a comma-decimal amount', () => {
    expect(parseEuroInput('1234,56')).toEqual({ ok: true, value: cents(123456) });
  });

  it('parses a whole-number amount', () => {
    expect(parseEuroInput('900')).toEqual({ ok: true, value: cents(90000) });
  });

  it('rejects an empty string', () => {
    expect(parseEuroInput('')).toEqual({ ok: false, error: 'empty' });
  });

  it('rejects a whitespace-only string', () => {
    expect(parseEuroInput('   ')).toEqual({ ok: false, error: 'empty' });
  });

  it('rejects a non-numeric string', () => {
    expect(parseEuroInput('abc')).toEqual({ ok: false, error: 'not_a_number' });
  });

  it('rejects a thousands-separated string (ambiguous grouping)', () => {
    expect(parseEuroInput('1.234,56')).toEqual({ ok: false, error: 'not_a_number' });
  });

  it('rejects a negative amount', () => {
    expect(parseEuroInput('-100')).toEqual({ ok: false, error: 'negative' });
  });

  it('rejects more than two decimal places', () => {
    expect(parseEuroInput('100.123')).toEqual({ ok: false, error: 'too_many_decimals' });
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseEuroInput('  1234,56  ')).toEqual({ ok: true, value: cents(123456) });
  });
});
