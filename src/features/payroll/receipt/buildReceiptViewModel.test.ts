import type { Employee, Employer, PayrollRun } from '@/types';
import { cents } from '@/types/money';

import { buildReceiptViewModel } from './buildReceiptViewModel';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_EMPLOYER: Employer = {
  id: 'employer-fake-1',
  name: 'Empleador de Prueba',
  nif: '00000000T',
  address: 'Calle Falsa 123',
  createdAt: 1_700_000_000_000,
};

const FAKE_EMPLOYEE: Employee = {
  id: 'employee-fake-1',
  employerId: FAKE_EMPLOYER.id,
  name: 'Empleada de Prueba',
  nif: '00000001T',
  naf: '000000000001',
  baseGrossCents: cents(90000),
  active: true,
  altaDate: null,
  bajaDate: null,
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
  createdAt: 1_700_000_000_000,
};

describe('buildReceiptViewModel', () => {
  it('itemizes salario base and prorrata pagas extra separately, summing to grossCents (SC1)', () => {
    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
    });

    expect(vm.devengos).toEqual([
      { label: 'Salario base', amount: '900,00 €' },
      { label: 'Prorrata pagas extraordinarias', amount: '150,00 €' },
    ]);
    expect(vm.totalDevengos).toBe('1050,00 €');
  });

  it('omits the pagas extra line when extraCents is zero', () => {
    const runNoExtra: PayrollRun = { ...FAKE_RUN, grossCents: cents(90000), extraCents: cents(0) };

    const vm = buildReceiptViewModel({
      run: runNoExtra,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
    });

    expect(vm.devengos).toEqual([{ label: 'Salario base', amount: '900,00 €' }]);
  });

  it('maps deducciones to the worker SS quota only', () => {
    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
    });

    expect(vm.deducciones).toEqual([
      { label: 'Cuota Seguridad Social (persona trabajadora)', amount: '45,00 €' },
    ]);
    expect(vm.totalDeducciones).toBe('45,00 €');
  });

  it('maps líquido total to netCents', () => {
    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
    });

    expect(vm.liquidoTotal).toBe('1005,00 €');
  });

  it('renders días trabajados/naturales and prorrateado from the persisted run (SC1)', () => {
    const proratedRun: PayrollRun = { ...FAKE_RUN, daysWorked: 20, daysInMonth: 30, prorated: true };

    const vm = buildReceiptViewModel({
      run: proratedRun,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
    });

    expect(vm.periodo).toEqual({
      descripcion: 'junio de 2026',
      diasTrabajados: 20,
      diasNaturales: 30,
      prorrateado: true,
    });
  });

  it('renders "—" for null employer nif/domicilio (SC2)', () => {
    const employerNoData: Employer = { ...FAKE_EMPLOYER, nif: null, address: null };

    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: employerNoData,
      issuedOnIso: '2026-08-04',
    });

    expect(vm.empleador.nif).toBe('—');
    expect(vm.empleador.domicilio).toBe('—');
  });

  it('renders "—" for null employee nif/naf', () => {
    const employeeNoData: Employee = { ...FAKE_EMPLOYEE, nif: null, naf: null };

    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: employeeNoData,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
    });

    expect(vm.trabajador.nif).toBe('—');
    expect(vm.trabajador.naf).toBe('—');
  });

  it('injects the issue date into lugarYFecha and never reads the system clock (SC3)', () => {
    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-01-01',
    });

    expect(vm.lugarYFecha).toContain('1 de enero de 2026');
  });

  it('is deterministic given identical inputs (SC3)', () => {
    const input = {
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
    };

    expect(buildReceiptViewModel(input)).toEqual(buildReceiptViewModel(input));
  });
});
