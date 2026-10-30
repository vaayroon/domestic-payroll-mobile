import { makeEmployee } from '@/features/employees/testing/fixtures';
import type { Employee, PayrollRun } from '@/types';
import { cents } from '@/types/money';

import { buildReceiptMailContent } from './buildReceiptMailContent';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_EMPLOYEE: Employee = makeEmployee({
  employerId: 'employer-fake-1',
  nif: '00000001T',
  naf: '000000000001',
});

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
  employerTotalEfectivoCents: null,
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

  describe('password wording variants (spec R11)', () => {
    const PLAIN_BODY =
      'Estimado/a Empleada de Prueba:\n\nAdjunto el recibo individual de salarios correspondiente a junio de 2026.\n\nUn saludo.';

    it('keeps the existing body byte for byte when no password source is given (S3)', () => {
      expect(buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE).body).toBe(PLAIN_BODY);
      expect(buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE, null).body).toBe(PLAIN_BODY);
    });

    it('tells the employee the password is their NIF/NIE for a document source (S1)', () => {
      expect(buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE, 'document').body).toBe(
        'Estimado/a Empleada de Prueba:\n\nAdjunto el recibo individual de salarios correspondiente a junio de 2026.\n\nEl archivo está protegido con contraseña para evitar aperturas accidentales. La contraseña es su NIF/NIE, en mayúsculas y sin espacios ni guiones.\n\nUn saludo.',
      );
    });

    it('says the password was provided separately for an override source, without revealing it (S2)', () => {
      const employee = makeEmployee({ nif: '00000001T', receiptPasswordOverride: 'clave 1' });

      const { body } = buildReceiptMailContent(FAKE_RUN, employee, 'override');

      expect(body).toBe(
        'Estimado/a Empleada de Prueba:\n\nAdjunto el recibo individual de salarios correspondiente a junio de 2026.\n\nEl archivo está protegido con contraseña para evitar aperturas accidentales. La contraseña es la que le hemos facilitado.\n\nUn saludo.',
      );
      expect(body).not.toContain('clave 1');
      expect(body).not.toContain('NIF');
    });

    it('never puts the employee document or override in the body for any source', () => {
      const employee = makeEmployee({ nif: '00000001T', receiptPasswordOverride: 'clave 1' });

      for (const source of ['document', 'override'] as const) {
        const { body, subject } = buildReceiptMailContent(FAKE_RUN, employee, source);
        expect(body).not.toContain('00000001T');
        expect(body).not.toContain('clave 1');
        expect(subject).toBe('Recibo de salarios — junio de 2026');
      }
    });

    it('does not use the words the framing forbids (spec R5)', () => {
      for (const source of ['document', 'override'] as const) {
        const { body } = buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE, source);
        expect(body).not.toMatch(/seguro|confidencial|imposible de abrir/i);
      }
    });
  });
});
