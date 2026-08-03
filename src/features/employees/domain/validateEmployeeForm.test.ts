import { cents } from '@/types/money';

import { validateEmployeeForm } from './validateEmployeeForm';

// Obviously-fake placeholder identifiers only (CLAUDE.md §6 — no real PII).
const FAKE_EMPLOYER_ID = 'employer-fake-1';

describe('validateEmployeeForm', () => {
  it('accepts a valid form with NIF/NAF blank', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900' },
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
      },
    });
  });

  it('trims NIF/NAF and keeps them when present', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: ' 00000000T ', naf: ' 000000000000 ', baseGross: '900' },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nif).toBe('00000000T');
      expect(result.value.naf).toBe('000000000000');
    }
  });

  it('rejects an empty name', () => {
    const result = validateEmployeeForm({ name: '  ', nif: '', naf: '', baseGross: '900' }, FAKE_EMPLOYER_ID);

    expect(result).toEqual({ ok: false, errors: { name: 'required' } });
  });

  it('rejects a zero base gross as not_positive', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '0' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baseGross: 'not_positive' } });
  });

  it('rejects an invalid base gross and forwards the parse error', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: 'abc' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baseGross: 'not_a_number' } });
  });

  it('reports both errors when name and base gross are both invalid', () => {
    const result = validateEmployeeForm({ name: '', nif: '', naf: '', baseGross: '' }, FAKE_EMPLOYER_ID);

    expect(result).toEqual({ ok: false, errors: { name: 'required', baseGross: 'empty' } });
  });
});
