import { cents } from '@/types/money';

import { parseIsoDate, validateEmployeeForm } from './validateEmployeeForm';

// Obviously-fake placeholder identifiers only (CLAUDE.md §6 — no real PII).
const FAKE_EMPLOYER_ID = 'employer-fake-1';

describe('validateEmployeeForm', () => {
  it('accepts a valid form with NIF/NAF blank', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900', alta: '', baja: '', contractType: 'INDEFINIDO' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        employerId: FAKE_EMPLOYER_ID,
        name: 'Empleado de Prueba',
        nif: null,
        naf: null,
        baseGrossCents: cents(90000),
        altaDate: null,
        bajaDate: null,
        contractType: 'INDEFINIDO',
      },
    });
  });

  it('accepts a valid form with contractType TEMPORAL', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900', alta: '', baja: '', contractType: 'TEMPORAL' },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractType).toBe('TEMPORAL');
    }
  });

  it('rejects a blank contractType as required', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900', alta: '', baja: '', contractType: '' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { contractType: 'required' } });
  });

  it('trims NIF/NAF and keeps them when present', () => {
    const result = validateEmployeeForm(
      {
        name: 'Empleado de Prueba',
        nif: ' 00000000T ',
        naf: ' 000000000000 ',
        baseGross: '900',
        alta: '',
        baja: '',
        contractType: 'INDEFINIDO',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nif).toBe('00000000T');
      expect(result.value.naf).toBe('000000000000');
    }
  });

  it('rejects an empty name', () => {
    const result = validateEmployeeForm(
      { name: '  ', nif: '', naf: '', baseGross: '900', alta: '', baja: '', contractType: 'INDEFINIDO' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { name: 'required' } });
  });

  it('rejects a zero base gross as not_positive', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '0', alta: '', baja: '', contractType: 'INDEFINIDO' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baseGross: 'not_positive' } });
  });

  it('rejects an invalid base gross and forwards the parse error', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: 'abc', alta: '', baja: '', contractType: 'INDEFINIDO' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baseGross: 'not_a_number' } });
  });

  it('reports both errors when name and base gross are both invalid', () => {
    const result = validateEmployeeForm(
      { name: '', nif: '', naf: '', baseGross: '', alta: '', baja: '', contractType: 'INDEFINIDO' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { name: 'required', baseGross: 'empty' } });
  });

  it('accepts a valid alta/baja ordering (baja after alta)', () => {
    const result = validateEmployeeForm(
      {
        name: 'Empleado de Prueba',
        nif: '',
        naf: '',
        baseGross: '900',
        alta: '2026-07-23',
        baja: '2026-12-31',
        contractType: 'INDEFINIDO',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        employerId: FAKE_EMPLOYER_ID,
        name: 'Empleado de Prueba',
        nif: null,
        naf: null,
        baseGrossCents: cents(90000),
        altaDate: '2026-07-23',
        bajaDate: '2026-12-31',
        contractType: 'INDEFINIDO',
      },
    });
  });

  it('accepts baja equal to alta (same-day employment)', () => {
    const result = validateEmployeeForm(
      {
        name: 'Empleado de Prueba',
        nif: '',
        naf: '',
        baseGross: '900',
        alta: '2026-07-23',
        baja: '2026-07-23',
        contractType: 'INDEFINIDO',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
  });

  it('rejects baja before alta with before_alta', () => {
    const result = validateEmployeeForm(
      {
        name: 'Empleado de Prueba',
        nif: '',
        naf: '',
        baseGross: '900',
        alta: '2026-12-31',
        baja: '2026-07-23',
        contractType: 'INDEFINIDO',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baja: 'before_alta' } });
  });

  it('accepts both alta and baja absent', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900', alta: '', baja: '', contractType: 'INDEFINIDO' },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.altaDate).toBeNull();
      expect(result.value.bajaDate).toBeNull();
    }
  });

  it('rejects a malformed alta date as invalid_date', () => {
    const result = validateEmployeeForm(
      {
        name: 'Empleado de Prueba',
        nif: '',
        naf: '',
        baseGross: '900',
        alta: '23-07-2026',
        baja: '',
        contractType: 'INDEFINIDO',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { alta: 'invalid_date' } });
  });

  it('rejects a calendar-invalid baja date as invalid_date', () => {
    const result = validateEmployeeForm(
      {
        name: 'Empleado de Prueba',
        nif: '',
        naf: '',
        baseGross: '900',
        alta: '',
        baja: '2026-02-30',
        contractType: 'INDEFINIDO',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baja: 'invalid_date' } });
  });
});

describe('parseIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(parseIsoDate('2026-07-23')).toEqual({ ok: true, iso: '2026-07-23' });
  });

  it('accepts a leap-day date in a leap year', () => {
    expect(parseIsoDate('2028-02-29')).toEqual({ ok: true, iso: '2028-02-29' });
  });

  it('rejects a leap-day date in a non-leap year', () => {
    expect(parseIsoDate('2026-02-29')).toEqual({ ok: false });
  });

  it('rejects a calendar-invalid day (Feb 30th)', () => {
    expect(parseIsoDate('2026-02-30')).toEqual({ ok: false });
  });

  it('rejects a malformed format', () => {
    expect(parseIsoDate('23-07-2026')).toEqual({ ok: false });
    expect(parseIsoDate('2026/07/23')).toEqual({ ok: false });
    expect(parseIsoDate('not-a-date')).toEqual({ ok: false });
  });
});
