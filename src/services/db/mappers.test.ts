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
    defaultLugar: 'Ciudad de Prueba',
    createdAt: 1_700_000_000_000,
  };

  it('maps a raw row to the Employer domain type unchanged (no money fields to brand)', () => {
    expect(employerRowToDomain(row)).toEqual({
      id: 'employer-1',
      name: 'Empleador Ejemplo',
      nif: '00000000T',
      address: 'Calle Falsa 123',
      ccc: '28000000000',
      defaultLugar: 'Ciudad de Prueba',
      createdAt: 1_700_000_000_000,
    });
  });

  it('preserves null nif/address/ccc/defaultLugar rather than coercing to undefined', () => {
    const nullableRow: EmployerRow = { ...row, nif: null, address: null, ccc: null, defaultLugar: null };
    const domain = employerRowToDomain(nullableRow);
    expect(domain.nif).toBeNull();
    expect(domain.address).toBeNull();
    expect(domain.ccc).toBeNull();
    expect(domain.defaultLugar).toBeNull();
  });

  it('builds an insert row from NewEmployer + generated id/createdAt', () => {
    expect(
      employerInsertFromNew(
        { name: 'Empleador Ejemplo', nif: '00000000T', ccc: '28000000000', defaultLugar: 'Ciudad de Prueba' },
        'employer-1',
        1_700_000_000_000,
      ),
    ).toEqual({
      id: 'employer-1',
      name: 'Empleador Ejemplo',
      nif: '00000000T',
      address: null,
      ccc: '28000000000',
      defaultLugar: 'Ciudad de Prueba',
      createdAt: 1_700_000_000_000,
    });
  });

  it('defaults ccc to null when omitted', () => {
    expect(employerInsertFromNew({ name: 'Empleador Ejemplo' }, 'employer-1', 1_700_000_000_000).ccc).toBeNull();
  });

  it('defaults defaultLugar to null when omitted', () => {
    expect(
      employerInsertFromNew({ name: 'Empleador Ejemplo' }, 'employer-1', 1_700_000_000_000).defaultLugar,
    ).toBeNull();
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
    grupoCotizacion: null,
    receiptEncryptionEnabled: false,
    receiptPasswordOverride: null,
    receiptFileNameFormat: null,
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
      grupoCotizacion: null,
      receiptEncryptionEnabled: false,
      receiptPasswordOverride: null,
      receiptFileNameFormat: null,
    });
  });

  it('maps a pre-0010 row (disabled, no override) to the same defaults', () => {
    const domain = employeeRowToDomain(row);
    expect(domain.receiptEncryptionEnabled).toBe(false);
    expect(domain.receiptPasswordOverride).toBeNull();
  });

  it('passes a stored receipt preference and override through unchanged', () => {
    const domain = employeeRowToDomain({ ...row, receiptEncryptionEnabled: true, receiptPasswordOverride: 'clave 1' });
    expect(domain.receiptEncryptionEnabled).toBe(true);
    expect(domain.receiptPasswordOverride).toBe('clave 1');
  });

  it('inserts an explicit receipt preference and override unchanged', () => {
    const insertRow = employeeInsertFromNew(
      {
        employerId: 'employer-1',
        name: 'Empleada Ejemplo',
        baseGrossCents: cents(100),
        receiptEncryptionEnabled: true,
        receiptPasswordOverride: 'clave 1',
      },
      'employee-1',
    );
    expect(insertRow.receiptEncryptionEnabled).toBe(true);
    expect(insertRow.receiptPasswordOverride).toBe('clave 1');
  });

  it('maps a null receipt_file_name_format (every pre-0011 row) to null: inherit the general setting', () => {
    expect(employeeRowToDomain({ ...row, receiptFileNameFormat: null }).receiptFileNameFormat).toBeNull();
  });

  it.each(['auto', 'name-month-year', 'name-year-month', 'year-month-name', 'month-year'])(
    'passes the stored receipt file name format %j through unchanged',
    (stored) => {
      expect(employeeRowToDomain({ ...row, receiptFileNameFormat: stored }).receiptFileNameFormat).toBe(stored);
    },
  );

  it.each(['bogus', '', 'AUTO', ' auto', 'toString', '__proto__', 'constructor', 'hasOwnProperty'])(
    'narrows the unknown stored receipt file name format %j to null (inherit)',
    (stored) => {
      expect(employeeRowToDomain({ ...row, receiptFileNameFormat: stored }).receiptFileNameFormat).toBeNull();
    },
  );

  it('defaults receiptFileNameFormat to null on insert when omitted', () => {
    const insertRow = employeeInsertFromNew(
      { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100) },
      'employee-1',
    );
    expect(insertRow.receiptFileNameFormat).toBeNull();
  });

  it.each([null, 'auto', 'name-month-year', 'month-year'] as const)(
    'inserts an explicit receiptFileNameFormat %j unchanged',
    (format) => {
      const insertRow = employeeInsertFromNew(
        { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100), receiptFileNameFormat: format },
        'employee-1',
      );
      expect(insertRow.receiptFileNameFormat).toBe(format);
    },
  );

  it('round-trips an employee insert row back to the same format through the mapper', () => {
    const insertRow = employeeInsertFromNew(
      { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100), receiptFileNameFormat: 'year-month-name' },
      'employee-1',
    );
    // What the DB does between the two mappers: the written column is read back as is.
    const readBack = employeeRowToDomain({ ...row, receiptFileNameFormat: insertRow.receiptFileNameFormat ?? null });
    expect(readBack.receiptFileNameFormat).toBe('year-month-name');
  });

  it('maps a null grupo_cotizacion (every pre-existing row) to null, not an empty string', () => {
    expect(employeeRowToDomain({ ...row, grupoCotizacion: null }).grupoCotizacion).toBeNull();
  });

  it('passes a stored grupo_cotizacion through unchanged', () => {
    expect(employeeRowToDomain({ ...row, grupoCotizacion: '7' }).grupoCotizacion).toBe('7');
  });

  it('defaults grupoCotizacion to null, not an empty string, on insert when omitted', () => {
    const insertRow = employeeInsertFromNew(
      { employerId: 'employer-1', name: 'Empleada Ejemplo', baseGrossCents: cents(100) },
      'employee-1',
    );
    expect(insertRow.grupoCotizacion).toBeNull();
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
    periodStartDate: null,
    periodEndDate: null,
    baseCotizacionCents: null,
    contractType: null,
    employerTotalEfectivoCents: null,
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
      periodStartDate: null,
      periodEndDate: null,
      baseCotizacionCents: null,
      contractType: null,
      employerTotalEfectivoCents: null,
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

  it('legacy row with NULL period range round-trips as null (Scenario 1)', () => {
    const domain = payrollRunRowToDomain({ ...row, periodStartDate: null, periodEndDate: null });
    expect(domain.periodStartDate).toBeNull();
    expect(domain.periodEndDate).toBeNull();
  });

  it('new row with a full period range round-trips exactly (Scenario 2)', () => {
    const domain = payrollRunRowToDomain({
      ...row,
      periodStartDate: '2026-06-01',
      periodEndDate: '2026-06-30',
    });
    expect(domain.periodStartDate).toBe('2026-06-01');
    expect(domain.periodEndDate).toBe('2026-06-30');
  });

  it('payrollRunInsertFromNew defaults periodStartDate/periodEndDate to null when omitted', () => {
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
    expect(insertRow.periodStartDate).toBeNull();
    expect(insertRow.periodEndDate).toBeNull();
  });

  it('payrollRunInsertFromNew passes through present periodStartDate/periodEndDate unchanged', () => {
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
        periodStartDate: '2026-06-01',
        periodEndDate: '2026-06-30',
      },
      'run-1',
      1_700_000_000_000,
    );
    expect(insertRow.periodStartDate).toBe('2026-06-01');
    expect(insertRow.periodEndDate).toBe('2026-06-30');
  });

  it('pre-anchor row round-trips every cotización anchor as null (spec A2.1)', () => {
    const domain = payrollRunRowToDomain({
      ...row,
      baseCotizacionCents: null,
      contractType: null,
      employerTotalEfectivoCents: null,
    });
    expect(domain.baseCotizacionCents).toBeNull();
    expect(domain.contractType).toBeNull();
    expect(domain.employerTotalEfectivoCents).toBeNull();
  });

  it('anchored row round-trips the base branded as Cents and the contract type unchanged', () => {
    const domain = payrollRunRowToDomain({ ...row, baseCotizacionCents: 115100, contractType: 'TEMPORAL' });
    expect(domain.baseCotizacionCents).toBe(cents(115100));
    expect(domain.contractType).toBe('TEMPORAL');
  });

  it('round-trips the employer total branded as Cents', () => {
    const domain = payrollRunRowToDomain({ ...row, employerTotalEfectivoCents: 31723 });
    expect(domain.employerTotalEfectivoCents).toBe(cents(31723));
  });

  it('keeps an employer total of 0 as 0, not null: a zero-day run really does cost the employer nothing', () => {
    const domain = payrollRunRowToDomain({ ...row, employerTotalEfectivoCents: 0 });
    expect(domain.employerTotalEfectivoCents).toBe(cents(0));
  });

  it('degrades an unrecognised stored contract type to null instead of letting it reach the rate tables', () => {
    // The Drizzle enum is compile-time only and the column has no SQL CHECK,
    // so this is whatever is on disk -- e.g. a row written by a newer build and
    // read back after a downgrade. Unanchored is a safe answer; a rate lookup
    // on an unknown key would produce NaN and throw mid-receipt.
    const domain = payrollRunRowToDomain({
      ...row,
      baseCotizacionCents: 115100,
      contractType: 'FIJO_DISCONTINUO' as unknown as PayrollRunRow['contractType'],
    });

    expect(domain.contractType).toBeNull();
    expect(domain.baseCotizacionCents).toBe(cents(115100)); // the base anchor survives on its own
  });

  it('payrollRunInsertFromNew defaults every anchor to null when omitted -- never to INDEFINIDO (design ADR-1)', () => {
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
    expect(insertRow.baseCotizacionCents).toBeNull();
    expect(insertRow.contractType).toBeNull();
    expect(insertRow.employerTotalEfectivoCents).toBeNull();
  });

  it('payrollRunInsertFromNew unbrands a present base and passes the contract type through', () => {
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
        baseCotizacionCents: cents(115100),
        contractType: 'TEMPORAL',
        employerTotalEfectivoCents: cents(31723),
      },
      'run-1',
      1_700_000_000_000,
    );
    expect(insertRow.baseCotizacionCents).toBe(115100);
    expect(insertRow.contractType).toBe('TEMPORAL');
    expect(insertRow.employerTotalEfectivoCents).toBe(31723);
  });

  // Every tramo base is positive, so a real run never carries base 0 -- this
  // pins the `??` against a `||` that would silently turn 0 into null.
  it('payrollRunInsertFromNew keeps a zero base as 0, not null (guards ?? against ||)', () => {
    const insertRow = payrollRunInsertFromNew(
      {
        employeeId: 'employee-1',
        periodYear: 2026,
        periodMonth: 6,
        grossCents: cents(0),
        ssDeductionCents: cents(0),
        netCents: cents(0),
        extraCents: cents(0),
        daysWorked: 0,
        daysInMonth: 30,
        baseCotizacionCents: cents(0),
        contractType: 'INDEFINIDO',
        // Unlike the base, a zero employer total is REACHABLE: this very run,
        // zero days worked, costs the employer nothing. Turning it into null
        // would downgrade a genuinely anchored run to an unanchored one.
        employerTotalEfectivoCents: cents(0),
      },
      'run-1',
      1_700_000_000_000,
    );
    expect(insertRow.baseCotizacionCents).toBe(0);
    expect(insertRow.employerTotalEfectivoCents).toBe(0);
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
