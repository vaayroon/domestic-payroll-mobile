import { cents } from '@/types/money';

import { formatEuros } from './formatEuros';

// `Intl.NumberFormat('es-ES', ...)` inserts a NON-BREAKING SPACE (U+00A0,
// not a regular space) between the amount and the `€` symbol.
const NBSP = ' ';

describe('formatEuros', () => {
  it('formats a whole-euro amount as Spanish EUR currency', () => {
    expect(formatEuros(cents(90000))).toBe(`900,00${NBSP}€`);
  });

  it('formats an amount with cents', () => {
    expect(formatEuros(cents(26129))).toBe(`261,29${NBSP}€`);
  });

  it('formats zero', () => {
    expect(formatEuros(cents(0))).toBe(`0,00${NBSP}€`);
  });

  it('formats a negative amount (e.g. a correction)', () => {
    expect(formatEuros(cents(-500))).toBe(`-5,00${NBSP}€`);
  });
});
