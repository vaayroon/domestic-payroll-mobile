/**
 * Pure euro-string -> `Cents` parser (design §"Pure functions").
 *
 * Accepts a single decimal separator (comma OR dot), rejects thousands
 * separators / ambiguous grouped input (e.g. "1.234,56") on purpose — this is
 * a deliberately narrow, unambiguous input format for a single text field.
 * The actual euro-to-cents conversion is delegated to `fromEuros` (CLAUDE.md
 * §4 — money is never a float in domain logic; rounding happens exactly once,
 * inside `fromEuros`, never by hand here).
 */

import { fromEuros, type Cents } from '@/types/money';

export type EuroParseError = 'empty' | 'not_a_number' | 'negative' | 'too_many_decimals';

export type EuroParseResult = { ok: true; value: Cents } | { ok: false; error: EuroParseError };

const SINGLE_SEPARATOR_PATTERN = /^-?\d+([.,]\d+)?$/;

export function parseEuroInput(raw: string): EuroParseResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: false, error: 'empty' };
  }

  if (!SINGLE_SEPARATOR_PATTERN.test(trimmed)) {
    return { ok: false, error: 'not_a_number' };
  }

  const normalized = trimmed.replace(',', '.');
  const value = Number(normalized);
  if (value < 0) {
    return { ok: false, error: 'negative' };
  }

  const [, decimals] = normalized.split('.');
  if (decimals !== undefined && decimals.length > 2) {
    return { ok: false, error: 'too_many_decimals' };
  }

  return { ok: true, value: fromEuros(value) };
}
