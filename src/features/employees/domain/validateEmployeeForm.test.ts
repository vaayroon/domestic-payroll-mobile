import { cents } from '@/types/money';

import {
  GRUPO_COTIZACION_MAX_LENGTH,
  parseIsoDate,
  validateEmployeeForm,
} from './validateEmployeeForm';

// Obviously-fake placeholder identifiers only (CLAUDE.md §6 — no real PII).
const FAKE_EMPLOYER_ID = 'employer-fake-1';

describe('validateEmployeeForm', () => {
  it('accepts a valid form with NIF/NAF blank', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900', alta: '', baja: '', grupoCotizacion: '', contractType: 'INDEFINIDO', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
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
        grupoCotizacion: null,
        receiptEncryptionEnabled: false,
        receiptPasswordOverride: null,
      },
    });
  });

  it('accepts a valid form with contractType TEMPORAL', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900', alta: '', baja: '', grupoCotizacion: '', contractType: 'TEMPORAL', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractType).toBe('TEMPORAL');
    }
  });

  it('rejects a blank contractType as required', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900', alta: '', baja: '', grupoCotizacion: '', contractType: '', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
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
        grupoCotizacion: '',
        contractType: 'INDEFINIDO',
        receiptEncryptionEnabled: false,
        receiptPasswordOverride: '',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nif).toBe('00000000T');
      expect(result.value.naf).toBe('000000000000');
    }
  });

  it('rejects a malformed NIF as invalid', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '12345678A', naf: '', baseGross: '900', alta: '', baja: '', grupoCotizacion: '', contractType: 'INDEFINIDO', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { nif: 'invalid' } });
  });

  it('rejects a malformed NAF as invalid', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '123', baseGross: '900', alta: '', baja: '', grupoCotizacion: '', contractType: 'INDEFINIDO', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { naf: 'invalid' } });
  });

  it('rejects an empty name', () => {
    const result = validateEmployeeForm(
      { name: '  ', nif: '', naf: '', baseGross: '900', alta: '', baja: '', grupoCotizacion: '', contractType: 'INDEFINIDO', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { name: 'required' } });
  });

  it('rejects a zero base gross as not_positive', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '0', alta: '', baja: '', grupoCotizacion: '', contractType: 'INDEFINIDO', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baseGross: 'not_positive' } });
  });

  it('rejects an invalid base gross and forwards the parse error', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: 'abc', alta: '', baja: '', grupoCotizacion: '', contractType: 'INDEFINIDO', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baseGross: 'not_a_number' } });
  });

  it('reports both errors when name and base gross are both invalid', () => {
    const result = validateEmployeeForm(
      { name: '', nif: '', naf: '', baseGross: '', alta: '', baja: '', grupoCotizacion: '', contractType: 'INDEFINIDO', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
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
        grupoCotizacion: '',
        contractType: 'INDEFINIDO',
        receiptEncryptionEnabled: false,
        receiptPasswordOverride: '',
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
        grupoCotizacion: null,
        receiptEncryptionEnabled: false,
        receiptPasswordOverride: null,
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
        grupoCotizacion: '',
        contractType: 'INDEFINIDO',
        receiptEncryptionEnabled: false,
        receiptPasswordOverride: '',
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
        grupoCotizacion: '',
        contractType: 'INDEFINIDO',
        receiptEncryptionEnabled: false,
        receiptPasswordOverride: '',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baja: 'before_alta' } });
  });

  it('accepts both alta and baja absent', () => {
    const result = validateEmployeeForm(
      { name: 'Empleado de Prueba', nif: '', naf: '', baseGross: '900', alta: '', baja: '', grupoCotizacion: '', contractType: 'INDEFINIDO', receiptEncryptionEnabled: false, receiptPasswordOverride: '' },
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
        grupoCotizacion: '',
        contractType: 'INDEFINIDO',
        receiptEncryptionEnabled: false,
        receiptPasswordOverride: '',
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
        grupoCotizacion: '',
        contractType: 'INDEFINIDO',
        receiptEncryptionEnabled: false,
        receiptPasswordOverride: '',
      },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { baja: 'invalid_date' } });
  });
});

describe('validateEmployeeForm grupoCotizacion', () => {
  const validInput = {
    name: 'Empleado de Prueba',
    nif: '',
    naf: '',
    baseGross: '900',
    alta: '',
    baja: '',
    grupoCotizacion: '',
    contractType: 'INDEFINIDO',
    receiptEncryptionEnabled: false,
    receiptPasswordOverride: '',
  } as const;

  it.each([
    ['', null],
    ['   ', null],
    ['  7  ', '7'],
  ])('trims %j and maps empty to null (got %j)', (raw, expected) => {
    const result = validateEmployeeForm({ ...validInput, grupoCotizacion: raw }, FAKE_EMPLOYER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.grupoCotizacion).toBe(expected);
    }
  });

  it('accepts exactly the 40-character layout bound unchanged', () => {
    const forty = 'x'.repeat(GRUPO_COTIZACION_MAX_LENGTH);
    const result = validateEmployeeForm({ ...validInput, grupoCotizacion: forty }, FAKE_EMPLOYER_ID);

    expect(GRUPO_COTIZACION_MAX_LENGTH).toBe(40);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.grupoCotizacion).toBe(forty);
    }
  });

  it('rejects 41 characters with too_long', () => {
    const result = validateEmployeeForm(
      { ...validInput, grupoCotizacion: 'x'.repeat(41) },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { grupoCotizacion: 'too_long' } });
  });

  it('measures the bound after trimming, not before', () => {
    const padded = `  ${'x'.repeat(40)}  `;
    const result = validateEmployeeForm({ ...validInput, grupoCotizacion: padded }, FAKE_EMPLOYER_ID);

    expect(result.ok).toBe(true);
  });

  it.each(['1', '11', 'Grupo 10 — Peones', 'abc'])(
    'accepts %j: the value is free text, there is no format or 1-11 check',
    (raw) => {
      const result = validateEmployeeForm({ ...validInput, grupoCotizacion: raw }, FAKE_EMPLOYER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.grupoCotizacion).toBe(raw);
      }
    },
  );

  it('accumulates a too_long group with an invalid NIF', () => {
    const result = validateEmployeeForm(
      { ...validInput, nif: '12345678A', grupoCotizacion: 'x'.repeat(41) },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { nif: 'invalid', grupoCotizacion: 'too_long' } });
  });
});

describe('validateEmployeeForm receipt protection', () => {
  const validInput = {
    name: 'Empleado de Prueba',
    nif: '',
    naf: '',
    baseGross: '900',
    alta: '',
    baja: '',
    grupoCotizacion: '',
    contractType: 'INDEFINIDO',
    receiptEncryptionEnabled: false,
    receiptPasswordOverride: '',
  } as const;

  it('keeps the preference off and the own password empty by default', () => {
    const result = validateEmployeeForm(validInput, FAKE_EMPLOYER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.receiptEncryptionEnabled).toBe(false);
      expect(result.value.receiptPasswordOverride).toBeNull();
    }
  });

  it.each([
    ['', null],
    ['   ', null],
    ['  clave 1  ', 'clave 1'],
  ])('trims the own password %j and maps blank to null (got %j)', (raw, expected) => {
    const result = validateEmployeeForm({ ...validInput, receiptPasswordOverride: raw }, FAKE_EMPLOYER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.receiptPasswordOverride).toBe(expected);
    }
  });

  it('enables the preference when the employee has an NIF/NIE', () => {
    const result = validateEmployeeForm(
      { ...validInput, nif: '00000000T', receiptEncryptionEnabled: true },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.receiptEncryptionEnabled).toBe(true);
      expect(result.value.receiptPasswordOverride).toBeNull();
    }
  });

  it('enables the preference with only an own password and no NIF/NIE', () => {
    const result = validateEmployeeForm(
      { ...validInput, receiptEncryptionEnabled: true, receiptPasswordOverride: 'clave 1' },
      FAKE_EMPLOYER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.receiptEncryptionEnabled).toBe(true);
      expect(result.value.receiptPasswordOverride).toBe('clave 1');
    }
  });

  it('blocks enabling the preference with neither an NIF/NIE nor an own password', () => {
    const result = validateEmployeeForm({ ...validInput, receiptEncryptionEnabled: true }, FAKE_EMPLOYER_ID);

    expect(result).toEqual({ ok: false, errors: { receiptEncryptionEnabled: 'password_unavailable' } });
  });

  it('treats a blank-only own password as missing when enabling the preference', () => {
    const result = validateEmployeeForm(
      { ...validInput, receiptEncryptionEnabled: true, receiptPasswordOverride: '   ' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { receiptEncryptionEnabled: 'password_unavailable' } });
  });

  it('blocks saving when the NIF/NIE and the own password are both cleared on an enabled employee', () => {
    const result = validateEmployeeForm(
      { ...validInput, nif: '  ', receiptEncryptionEnabled: true, receiptPasswordOverride: '' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { receiptEncryptionEnabled: 'password_unavailable' } });
  });

  it('allows a preference that is off without any password source', () => {
    const result = validateEmployeeForm(validInput, FAKE_EMPLOYER_ID);

    expect(result.ok).toBe(true);
  });

  it('accepts an own password of exactly 32 printable ASCII characters', () => {
    const thirtyTwo = 'a'.repeat(32);
    const result = validateEmployeeForm({ ...validInput, receiptPasswordOverride: thirtyTwo }, FAKE_EMPLOYER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.receiptPasswordOverride).toBe(thirtyTwo);
    }
  });

  it('rejects an own password of 33 characters as too_long', () => {
    const result = validateEmployeeForm(
      { ...validInput, receiptPasswordOverride: 'a'.repeat(33) },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { receiptPasswordOverride: 'too_long' } });
  });

  it.each(['contraseña', 'clave €', 'clave 😀', 'a\u0007b'])(
    'rejects the own password %j as invalid_characters',
    (raw) => {
      const result = validateEmployeeForm({ ...validInput, receiptPasswordOverride: raw }, FAKE_EMPLOYER_ID);

      expect(result).toEqual({ ok: false, errors: { receiptPasswordOverride: 'invalid_characters' } });
    },
  );

  it('rejects an invalid own password even while the preference is off', () => {
    const result = validateEmployeeForm(
      { ...validInput, receiptEncryptionEnabled: false, receiptPasswordOverride: 'ñ' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { receiptPasswordOverride: 'invalid_characters' } });
  });

  it('reports only the own-password error, not "unavailable", when the preference is on and the own password is invalid', () => {
    const result = validateEmployeeForm(
      { ...validInput, receiptEncryptionEnabled: true, receiptPasswordOverride: 'ñ' },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { receiptPasswordOverride: 'invalid_characters' } });
  });

  it('reports only the NIF error, not "unavailable", when the preference is on and the NIF is malformed', () => {
    const result = validateEmployeeForm(
      { ...validInput, nif: '12345678A', receiptEncryptionEnabled: true },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { nif: 'invalid' } });
  });

  it('accumulates the own-password error with other field errors', () => {
    const result = validateEmployeeForm(
      { ...validInput, name: '', receiptPasswordOverride: 'a'.repeat(33) },
      FAKE_EMPLOYER_ID,
    );

    expect(result).toEqual({ ok: false, errors: { name: 'required', receiptPasswordOverride: 'too_long' } });
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
