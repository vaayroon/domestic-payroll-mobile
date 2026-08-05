import { validateEmployerForm } from './validateEmployerForm';

// Obviously-fake placeholder identifiers only (CLAUDE.md §6 — no real PII).
describe('validateEmployerForm', () => {
  it('accepts a valid form with nif/address/ccc blank', () => {
    const result = validateEmployerForm({ name: 'Empleador de Prueba', nif: '', address: '', ccc: '' });

    expect(result).toEqual({
      ok: true,
      value: { name: 'Empleador de Prueba', nif: null, address: null, ccc: null },
    });
  });

  it('accepts a valid form with nif/address/ccc filled in', () => {
    const result = validateEmployerForm({
      name: 'Empleador de Prueba',
      nif: '00000000T',
      address: 'Calle Falsa 123',
      ccc: '28000000000',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Empleador de Prueba',
        nif: '00000000T',
        address: 'Calle Falsa 123',
        ccc: '28000000000',
      },
    });
  });

  it('trims name and address', () => {
    const result = validateEmployerForm({ name: '  Empleador de Prueba  ', nif: '', address: '  Calle Falsa 123  ', ccc: '' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Empleador de Prueba');
      expect(result.value.address).toBe('Calle Falsa 123');
    }
  });

  it('rejects an empty name as required', () => {
    const result = validateEmployerForm({ name: '   ', nif: '', address: '', ccc: '' });
    expect(result).toEqual({ ok: false, errors: { name: 'required' } });
  });

  it('rejects an invalid nif and reports its error code', () => {
    const result = validateEmployerForm({ name: 'Empleador de Prueba', nif: '12345678A', address: '', ccc: '' });
    expect(result).toEqual({ ok: false, errors: { nif: 'invalid_checksum' } });
  });

  it('rejects an invalid ccc and reports its error code', () => {
    const result = validateEmployerForm({ name: 'Empleador de Prueba', nif: '', address: '', ccc: '123' });
    expect(result).toEqual({ ok: false, errors: { ccc: 'invalid_format' } });
  });

  it('composes multiple field errors together', () => {
    const result = validateEmployerForm({ name: '', nif: '12345678A', address: '', ccc: '123' });
    expect(result).toEqual({
      ok: false,
      errors: { name: 'required', nif: 'invalid_checksum', ccc: 'invalid_format' },
    });
  });
});
