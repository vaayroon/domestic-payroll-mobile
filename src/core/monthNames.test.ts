import { MONTH_NAMES as FROM_FORMAT_SPANISH_DATE } from '@/features/payroll/formatSpanishDate';

import { MONTH_NAMES } from './monthNames';

describe('MONTH_NAMES', () => {
  it('lists the twelve Spanish month names, lowercase, January first', () => {
    expect(MONTH_NAMES).toEqual([
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ]);
  });

  it('is the very same array formatSpanishDate re-exports', () => {
    expect(FROM_FORMAT_SPANISH_DATE).toBe(MONTH_NAMES);
  });
});
