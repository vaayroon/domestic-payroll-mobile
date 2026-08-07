/**
 * In-memory `EmployerRepository`/`EmployeeRepository` fakes for unit tests
 * (design §"Testing plan" / task 1.6). Follows the same DI-injection pattern
 * as `SmokeScreen.test.tsx`'s in-memory `SettingsRepository`: real
 * `expo-sqlite` cannot run under `jest-expo` headless, so hooks and screens
 * are exercised against these fakes through `RepositoryProvider` instead.
 *
 * Any seed data passed into these fakes from tests MUST be obviously fake
 * (CLAUDE.md §6 — no real PII in source, docs, fixtures, or tests).
 */

import type { Employee, EmployeeRepository, Employer, EmployerRepository, NewEmployee, NewEmployer } from '@/types';

let nextFakeId = 0;

/** Deterministic, test-only id generator — never used outside fakes. */
function generateFakeId(prefix: string): string {
  nextFakeId += 1;
  return `${prefix}-fake-${nextFakeId}`;
}

export class InMemoryEmployerRepository implements EmployerRepository {
  private readonly rows: Employer[];

  constructor(seed: Employer[] = []) {
    this.rows = [...seed];
  }

  async list(): Promise<Employer[]> {
    return [...this.rows].sort((a, b) => a.createdAt - b.createdAt);
  }

  async getById(id: string): Promise<Employer | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(input: NewEmployer): Promise<Employer> {
    const employer: Employer = {
      id: generateFakeId('employer'),
      name: input.name,
      nif: input.nif ?? null,
      address: input.address ?? null,
      ccc: input.ccc ?? null,
      defaultLugar: input.defaultLugar ?? null,
      createdAt: Date.now(),
    };
    this.rows.push(employer);
    return employer;
  }

  async update(id: string, patch: Partial<NewEmployer>): Promise<Employer> {
    const index = this.rows.findIndex((row) => row.id === id);
    const existing = this.rows[index];
    if (index === -1 || existing === undefined) {
      throw new Error(`InMemoryEmployerRepository.update: no employer found for id "${id}"`);
    }
    const updated: Employer = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.nif !== undefined ? { nif: patch.nif } : {}),
      ...(patch.address !== undefined ? { address: patch.address } : {}),
      ...(patch.ccc !== undefined ? { ccc: patch.ccc } : {}),
      ...(patch.defaultLugar !== undefined ? { defaultLugar: patch.defaultLugar } : {}),
    };
    this.rows[index] = updated;
    return updated;
  }

  async remove(id: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index !== -1) {
      this.rows.splice(index, 1);
    }
  }
}

export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly rows: Employee[];

  constructor(seed: Employee[] = []) {
    this.rows = [...seed];
  }

  async list(employerId: string): Promise<Employee[]> {
    return this.rows.filter((row) => row.employerId === employerId);
  }

  async getById(id: string): Promise<Employee | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(input: NewEmployee): Promise<Employee> {
    const employee: Employee = {
      id: generateFakeId('employee'),
      employerId: input.employerId,
      name: input.name,
      nif: input.nif ?? null,
      naf: input.naf ?? null,
      baseGrossCents: input.baseGrossCents,
      active: input.active ?? true,
      altaDate: input.altaDate ?? null,
      bajaDate: input.bajaDate ?? null,
      contractType: input.contractType ?? 'INDEFINIDO',
    };
    this.rows.push(employee);
    return employee;
  }

  async update(id: string, patch: Partial<NewEmployee>): Promise<Employee> {
    const index = this.rows.findIndex((row) => row.id === id);
    const existing = this.rows[index];
    if (index === -1 || existing === undefined) {
      throw new Error(`InMemoryEmployeeRepository.update: no employee found for id "${id}"`);
    }
    const updated: Employee = {
      ...existing,
      ...(patch.employerId !== undefined ? { employerId: patch.employerId } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.nif !== undefined ? { nif: patch.nif } : {}),
      ...(patch.naf !== undefined ? { naf: patch.naf } : {}),
      ...(patch.baseGrossCents !== undefined ? { baseGrossCents: patch.baseGrossCents } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.altaDate !== undefined ? { altaDate: patch.altaDate } : {}),
      ...(patch.bajaDate !== undefined ? { bajaDate: patch.bajaDate } : {}),
      ...(patch.contractType !== undefined ? { contractType: patch.contractType } : {}),
    };
    this.rows[index] = updated;
    return updated;
  }

  async remove(id: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index !== -1) {
      this.rows.splice(index, 1);
    }
  }
}
