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
