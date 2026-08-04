import { formatSpanishDate, formatSpanishMonthYear, MONTH_NAMES } from './formatSpanishDate';

describe('formatSpanishMonthYear', () => {
  it('formats a mid-year month', () => {
    expect(formatSpanishMonthYear(2026, 6)).toBe('junio de 2026');
  });

  it('formats January (lower boundary)', () => {
    expect(formatSpanishMonthYear(2026, 1)).toBe('enero de 2026');
  });

  it('formats December (upper boundary)', () => {
    expect(formatSpanishMonthYear(2026, 12)).toBe('diciembre de 2026');
  });
});

describe('formatSpanishDate', () => {
  it('formats an ISO date into a Spanish long date', () => {
    expect(formatSpanishDate('2026-08-04')).toBe('4 de agosto de 2026');
  });

  it('formats the first day of a month', () => {
    expect(formatSpanishDate('2026-01-01')).toBe('1 de enero de 2026');
  });

  it('formats the last day of December', () => {
    expect(formatSpanishDate('2026-12-31')).toBe('31 de diciembre de 2026');
  });
});

describe('MONTH_NAMES', () => {
  it('has exactly 12 entries in calendar order', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('enero');
    expect(MONTH_NAMES[11]).toBe('diciembre');
  });
});
