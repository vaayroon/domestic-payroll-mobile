import type { Employee, PayrollRun } from '@/types';
import { cents } from '@/types/money';

import { buildReceiptMailContent } from './buildReceiptMailContent';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_EMPLOYEE: Employee = {
  id: 'employee-fake-1',
  employerId: 'employer-fake-1',
  name: 'Empleada de Prueba',
  nif: '00000001T',
  naf: '000000000001',
  baseGrossCents: cents(90000),
  active: true,
  altaDate: null,
  bajaDate: null,
  contractType: 'INDEFINIDO',
};

const FAKE_RUN: PayrollRun = {
  id: 'run-fake-1',
  employeeId: FAKE_EMPLOYEE.id,
  periodYear: 2026,
  periodMonth: 6,
  grossCents: cents(105000),
  ssDeductionCents: cents(4500),
  netCents: cents(100500),
  prorated: false,
  extraCents: cents(15000),
  daysWorked: 30,
  daysInMonth: 30,
  periodStartDate: null,
  periodEndDate: null,
  baseCotizacionCents: null,
  contractType: null,
  createdAt: 1_700_000_000_000,
};

describe('buildReceiptMailContent', () => {
  it('builds a Spanish subject with the "Recibo de salarios — {mes} {año}" shape', () => {
    const { subject } = buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE);

    expect(subject).toBe('Recibo de salarios — junio de 2026');
  });

  it('builds a Spanish body naming the employee and the period, with no PII beyond the name', () => {
    const { body } = buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE);

    expect(body).toContain(FAKE_EMPLOYEE.name);
    expect(body).toContain('junio de 2026');
  });

  it('never leaks raw Cents amounts into the body', () => {
    const { body, subject } = buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE);

    expect(body).not.toContain(String(FAKE_RUN.grossCents));
    expect(body).not.toContain(String(FAKE_RUN.netCents));
    expect(body).not.toContain(String(FAKE_RUN.ssDeductionCents));
    expect(subject).not.toContain(String(FAKE_RUN.grossCents));
  });

  it('is deterministic given identical inputs', () => {
    expect(buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE)).toEqual(
      buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE),
    );
  });
});
