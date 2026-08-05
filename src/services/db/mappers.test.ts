import { cents } from '@/types/money';

import {
  appSettingRowToDomain,
  employeeInsertFromNew,
  employeeRowToDomain,
  employerInsertFromNew,
  employerRowToDomain,
  payrollRunInsertFromNew,
  payrollRunRowToDomain,
} from './mappers';
import type { EmployeeRow, EmployerRow, PayrollRunRow } from './schema';

describe('employerRowToDomain / employerInsertFromNew', () => {
  const row: EmployerRow = {
    id: 'employer-1',
    name: 'Empleador Ejemplo',
    nif: '00000000T',
    address: 'Calle Falsa 123',
    ccc: '28000000000',
    createdAt: 1_700_000_000_000,
  };

  it('maps a raw row to the Employer domain type unchanged (no money fields to brand)', () => {
    expect(employerRowToDomain(row)).toEqual({
      id: 'employer-1',
      name: 'Empleador Ejemplo',
      nif: '00000000T',
      address: 'Calle Falsa 123',
      ccc: '28000000000',
      createdAt: 1_700_000_000_000,
    });
  });

  it('preserves null nif/address/ccc rather than coercing to undefined', () => {
    const nullableRow: EmployerRow = { ...row, nif: null, address: null, ccc: null };
    const domain = employerRowToDomain(nullableRow);
    expect(domain.nif).toBeNull();
    expect(domain.address).toBeNull();
    expect(domain.ccc).toBeNull();
  });

  it('builds an insert row from NewEmployer + generated id/createdAt', () => {
    expect(
      employerInsertFromNew({ name: 'Empleador Ejemplo', nif: '00000000T', ccc: '28000000000' }, 'employer-1', 1_700_000_000_000),
    ).toEqual({
      id: 'employer-1',
      name: 'Empleador Ejemplo',
      nif: '00000000T',
      address: null,
      ccc: '28000000000',
      createdAt: 1_700_000_000_000,
    });
  });

  it('defaults ccc to null when omitted', () => {
    expect(employerInsertFromNew({ name: 'Empleador Ejemplo' }, 'employer-1', 1_700_000_000_000).ccc).toBeNull();
  });
});

describe('employeeRowToDomain / employeeInsertFromNew', () => {
  const row: EmployeeRow = {
    id: 'employee-1',
    employerId: 'employer-1',
    name: 'Empleada Ejemplo',
    nif: '00000001T',
    naf: '000000000001',
    baseGrossCents: 123456,
    active: true,
    altaDate: null,
    bajaDate: null,
    contractType: 'INDEFINIDO',
  };

  it('brands baseGrossCents as Cents on the way out of the DB', () => {
    const domain = employeeRowToDomain(row);
    expect(domain.baseGrossCents).toBe(cents(123456));
  });

  it('passes through non-money fields unchanged', () => {
    const domain = employeeRowToDomain(row);
    expect(domain).toMatchObject({
      id: 'employee-1',
      employerId: 'employer-1',
      name: 'Empleada Ejemplo',
      nif: '00000001T',
      naf: '000000000001',
      active: true,
    });
  });

  it('builds an insert row unbranding Cents back to a plain integer', () => {
    const insertRow = employeeInsertFromNew(
      { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(123456) },
      'employee-1',
    );
    expect(insertRow).toEqual({
      id: 'employee-1',
      employerId: 'employer-1',
      name: 'Empleada Ejemplo',
      nif: null,
      naf: null,
      baseGrossCents: 123456,
      active: true,
      altaDate: null,
      bajaDate: null,
      contractType: 'INDEFINIDO',
    });
  });

  it('defaults contractType to INDEFINIDO and honors an explicit TEMPORAL', () => {
    expect(
      employeeInsertFromNew(
        { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100), contractType: 'TEMPORAL' },
        'employee-1',
      ).contractType,
    ).toBe('TEMPORAL');
  });

  it('defaults active to true and honors an explicit false', () => {
    expect(
      employeeInsertFromNew(
        { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100), active: false },
        'employee-1',
      ).active,
    ).toBe(false);
  });

  it('round-trips null altaDate/bajaDate through employeeRowToDomain', () => {
    const domain = employeeRowToDomain({ ...row, altaDate: null, bajaDate: null });
    expect(domain.altaDate).toBeNull();
    expect(domain.bajaDate).toBeNull();
  });

  it('round-trips present altaDate/bajaDate ISO strings through employeeRowToDomain unchanged', () => {
    const domain = employeeRowToDomain({ ...row, altaDate: '2026-07-23', bajaDate: '2026-12-31' });
    expect(domain.altaDate).toBe('2026-07-23');
    expect(domain.bajaDate).toBe('2026-12-31');
  });

  it('employeeInsertFromNew defaults altaDate/bajaDate to null when omitted', () => {
    const insertRow = employeeInsertFromNew(
      { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100) },
      'employee-1',
    );
    expect(insertRow.altaDate).toBeNull();
    expect(insertRow.bajaDate).toBeNull();
  });

  it('employeeInsertFromNew passes through present altaDate/bajaDate unchanged', () => {
    const insertRow = employeeInsertFromNew(
      {
        employerId: 'employer-1',
        name: 'Empleada Ejemplo',
        baseGrossCents: cents(100),
        altaDate: '2026-07-23',
        bajaDate: '2026-12-31',
      },
      'employee-1',
    );
    expect(insertRow.altaDate).toBe('2026-07-23');
    expect(insertRow.bajaDate).toBe('2026-12-31');
  });
});

describe('payrollRunRowToDomain / payrollRunInsertFromNew', () => {
  const row: PayrollRunRow = {
    id: 'run-1',
    employeeId: 'employee-1',
    periodYear: 2026,
    periodMonth: 6,
    grossCents: 150000,
    ssDeductionCents: 9000,
    netCents: 141000,
    prorated: false,
    extraCents: 30000,
    daysWorked: 20,
    daysInMonth: 30,
    createdAt: 1_700_000_000_000,
  };

  it('brands all four money fields as Cents', () => {
    const domain = payrollRunRowToDomain(row);
    expect(domain.grossCents).toBe(cents(150000));
    expect(domain.ssDeductionCents).toBe(cents(9000));
    expect(domain.netCents).toBe(cents(141000));
    expect(domain.extraCents).toBe(cents(30000));
  });

  it('round-trips daysWorked/daysInMonth unchanged (no rounding/branding, plain integers)', () => {
    const domain = payrollRunRowToDomain(row);
    expect(domain.daysWorked).toBe(20);
    expect(domain.daysInMonth).toBe(30);
  });

  it('builds an insert row unbranding all four money fields', () => {
    const insertRow = payrollRunInsertFromNew(
      {
        employeeId: 'employee-1',
        periodYear: 2026,
        periodMonth: 6,
        grossCents: cents(150000),
        ssDeductionCents: cents(9000),
        netCents: cents(141000),
        prorated: true,
        extraCents: cents(30000),
        daysWorked: 20,
        daysInMonth: 30,
      },
      'run-1',
      1_700_000_000_000,
    );
    expect(insertRow).toEqual({
      id: 'run-1',
      employeeId: 'employee-1',
      periodYear: 2026,
      periodMonth: 6,
      grossCents: 150000,
      ssDeductionCents: 9000,
      netCents: 141000,
      prorated: true,
      extraCents: 30000,
      daysWorked: 20,
      daysInMonth: 30,
      createdAt: 1_700_000_000_000,
    });
  });

  it('defaults prorated to false when omitted', () => {
    const insertRow = payrollRunInsertFromNew(
      {
        employeeId: 'employee-1',
        periodYear: 2026,
        periodMonth: 6,
        grossCents: cents(150000),
        ssDeductionCents: cents(9000),
        netCents: cents(141000),
        extraCents: cents(0),
        daysWorked: 30,
        daysInMonth: 30,
      },
      'run-1',
      1_700_000_000_000,
    );
    expect(insertRow.prorated).toBe(false);
  });
});

describe('appSettingRowToDomain', () => {
  it('passes key/value through unchanged (no money fields)', () => {
    expect(appSettingRowToDomain({ key: 'smoke', value: '2026-07-30T00:00:00.000Z' })).toEqual({
      key: 'smoke',
      value: '2026-07-30T00:00:00.000Z',
    });
  });
});
