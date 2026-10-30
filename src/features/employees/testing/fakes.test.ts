import { cents } from '@/types/money';

import { InMemoryEmployeeRepository } from './fakes';

/**
 * Parity checks for the `grupoCotizacion` semantics the Drizzle adapter
 * implements (`EmployeeRepositoryDrizzle.update`): `null` clears, an omitted
 * key leaves the value alone. The Drizzle half has no SQLite harness in this
 * repo and is verified by reading its `update` spread, so this fake is the
 * only executable statement of the contract.
 */
describe('InMemoryEmployeeRepository grupoCotizacion', () => {
  const newEmployee = { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100000) };

  it('creates an employee without a group as null, not an empty string', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create(newEmployee);
    expect(created.grupoCotizacion).toBeNull();
    expect((await repo.getById(created.id))?.grupoCotizacion).toBeNull();
  });

  it('stores a group given at creation', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({ ...newEmployee, grupoCotizacion: '7' });
    expect(created.grupoCotizacion).toBe('7');
  });

  it('clears the stored group when updated with an explicit null', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({ ...newEmployee, grupoCotizacion: '7' });
    const updated = await repo.update(created.id, { grupoCotizacion: null });
    expect(updated.grupoCotizacion).toBeNull();
    expect((await repo.getById(created.id))?.grupoCotizacion).toBeNull();
  });

  it('leaves the stored group alone when the patch does not mention it', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({ ...newEmployee, grupoCotizacion: '7' });
    const updated = await repo.update(created.id, { name: 'Otro Nombre Ficticio' });
    expect(updated.grupoCotizacion).toBe('7');
  });
});

describe('InMemoryEmployeeRepository receipt encryption fields', () => {
  const newEmployee = { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100000) };

  it('creates an employee with the preference off and no override', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create(newEmployee);
    expect(created.receiptEncryptionEnabled).toBe(false);
    expect(created.receiptPasswordOverride).toBeNull();
  });

  it('stores a preference and override given at creation', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({
      ...newEmployee,
      receiptEncryptionEnabled: true,
      receiptPasswordOverride: 'clave 1',
    });
    expect(created.receiptEncryptionEnabled).toBe(true);
    expect(created.receiptPasswordOverride).toBe('clave 1');
  });

  it('clears the override with an explicit null and leaves the preference alone', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({
      ...newEmployee,
      receiptEncryptionEnabled: true,
      receiptPasswordOverride: 'clave 1',
    });
    const updated = await repo.update(created.id, { receiptPasswordOverride: null });
    expect(updated.receiptPasswordOverride).toBeNull();
    expect(updated.receiptEncryptionEnabled).toBe(true);
    expect((await repo.getById(created.id))?.receiptPasswordOverride).toBeNull();
  });

  it('leaves both fields alone when the patch does not mention them', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({
      ...newEmployee,
      receiptEncryptionEnabled: true,
      receiptPasswordOverride: 'clave 1',
    });
    const updated = await repo.update(created.id, { name: 'Otro Nombre Ficticio' });
    expect(updated.receiptEncryptionEnabled).toBe(true);
    expect(updated.receiptPasswordOverride).toBe('clave 1');
  });

  it('turns the preference off with an explicit false (false is a value, not "absent")', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({ ...newEmployee, receiptEncryptionEnabled: true });
    const updated = await repo.update(created.id, { receiptEncryptionEnabled: false });
    expect(updated.receiptEncryptionEnabled).toBe(false);
  });
});

describe('InMemoryEmployeeRepository receiptFileNameFormat', () => {
  const newEmployee = { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100000) };

  it('creates an employee that inherits the general setting (null) when none is given', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create(newEmployee);
    expect(created.receiptFileNameFormat).toBeNull();
  });

  it.each(['auto', 'name-year-month'] as const)('stores the format %j given at creation', async (format) => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({ ...newEmployee, receiptFileNameFormat: format });
    expect(created.receiptFileNameFormat).toBe(format);
    expect((await repo.getById(created.id))?.receiptFileNameFormat).toBe(format);
  });

  it('changes the format on update', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({ ...newEmployee, receiptFileNameFormat: 'auto' });
    const updated = await repo.update(created.id, { receiptFileNameFormat: 'month-year' });
    expect(updated.receiptFileNameFormat).toBe('month-year');
  });

  it('goes back to inheriting with an explicit null (null is a value, not "absent")', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({ ...newEmployee, receiptFileNameFormat: 'auto' });
    const updated = await repo.update(created.id, { receiptFileNameFormat: null });
    expect(updated.receiptFileNameFormat).toBeNull();
    expect((await repo.getById(created.id))?.receiptFileNameFormat).toBeNull();
  });

  it('leaves the format alone when the patch does not mention it', async () => {
    const repo = new InMemoryEmployeeRepository();
    const created = await repo.create({ ...newEmployee, receiptFileNameFormat: 'auto' });
    const updated = await repo.update(created.id, { name: 'Empleada Renombrada' });
    expect(updated.receiptFileNameFormat).toBe('auto');
  });
});
