import { i18n } from './i18n';
import { formatMonthYear } from './formatMonthYear';

describe('formatMonthYear', () => {
  it('formats the Spanish label', () => {
    expect(formatMonthYear(i18n.t, 2026, 6)).toBe('junio de 2026');
    expect(formatMonthYear(i18n.t, 2026, 12)).toBe('diciembre de 2026');
  });

  it('formats the English label', async () => {
    await i18n.changeLanguage('en');
    expect(formatMonthYear(i18n.t, 2026, 6)).toBe('June 2026');
    expect(formatMonthYear(i18n.t, 2026, 1)).toBe('January 2026');
  });

  it('rejects an out-of-range month', () => {
    expect(() => formatMonthYear(i18n.t, 2026, 13)).toThrow(RangeError);
    expect(() => formatMonthYear(i18n.t, 2026, 0)).toThrow(RangeError);
  });
});
