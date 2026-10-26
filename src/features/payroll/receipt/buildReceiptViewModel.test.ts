import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from '@/core/testing/fixtures';
import { FAKE_EMPLOYER as FAKE_EMPLOYER_SEED } from '@/features/employees/testing/fixtures';
import type { Employee, Employer, PayrollRun } from '@/types';
import { cents } from '@/types/money';

import { SS_RATES_BY_YEAR, type RatesConfig } from '../domain/ssContribution';
import { buildReceiptViewModel } from './buildReceiptViewModel';

// `Intl.NumberFormat('es-ES', ...)` inserts a NON-BREAKING SPACE (U+00A0,
// not a regular space) between the amount and the `€` symbol.
const NBSP = ' ';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
// Overrides the shared fixture's null defaults with real values so the
// "renders '—' only for null fields" tests below have a meaningful non-null
// baseline to null out.
const FAKE_EMPLOYER: Employer = {
  ...FAKE_EMPLOYER_SEED,
  id: 'employer-fake-1',
  name: 'Empleador de Prueba',
  nif: '00000000T',
  address: 'Calle Falsa 123',
  ccc: '28123456789',
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
  employerTotalEfectivoCents: null,
  createdAt: 1_700_000_000_000,
};

const RATES_2026: RatesConfig = SS_RATES_BY_YEAR[2026] as RatesConfig;

describe('buildReceiptViewModel', () => {
  it('itemizes salario base and prorrata pagas extra separately, summing to grossCents (SC1)', () => {
    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
    });

    expect(vm.devengos).toEqual([
      { label: 'Salario base', amount: `900,00${NBSP}€` },
      { label: 'Prorrata pagas extraordinarias', amount: `150,00${NBSP}€` },
    ]);
    expect(vm.totalDevengos).toBe(`1050,00${NBSP}€`);
  });

  it('omits the pagas extra line when extraCents is zero', () => {
    const runNoExtra: PayrollRun = { ...FAKE_RUN, grossCents: cents(90000), extraCents: cents(0) };

    const vm = buildReceiptViewModel({
      run: runNoExtra,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
    });

    expect(vm.devengos).toEqual([{ label: 'Salario base', amount: `900,00${NBSP}€` }]);
  });

  it('maps deducciones to the worker SS quota only (lump line, unchanged)', () => {
    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
    });

    expect(vm.deducciones).toEqual([
      { label: 'Cuota Seguridad Social (persona trabajadora)', amount: `45,00${NBSP}€` },
    ]);
    expect(vm.totalDeducciones).toBe(`45,00${NBSP}€`);
  });

  it('maps líquido total to netCents', () => {
    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
    });

    expect(vm.liquidoTotal).toBe(`1005,00${NBSP}€`);
  });

  it('renders días trabajados/naturales and prorrateado from the persisted run (SC1)', () => {
    const proratedRun: PayrollRun = { ...FAKE_RUN, daysWorked: 20, daysInMonth: 30, prorated: true };

    const vm = buildReceiptViewModel({
      run: proratedRun,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
    });

    expect(vm.periodo).toEqual({
      descripcion: 'junio de 2026',
      diasTrabajados: 20,
      diasNaturales: 30,
      prorrateado: true,
      rango: null,
    });
  });

  it('renders "—" for null employer nif/domicilio/ccc (SC2)', () => {
    const employerNoData: Employer = { ...FAKE_EMPLOYER, nif: null, address: null, ccc: null };

    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: employerNoData,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
    });

    expect(vm.empleador.nif).toBe('—');
    expect(vm.empleador.domicilio).toBe('—');
    expect(vm.empleador.ccc).toBe('—');
  });

  it('renders "—" for null employee nif/naf', () => {
    const employeeNoData: Employee = { ...FAKE_EMPLOYEE, nif: null, naf: null };

    const vm = buildReceiptViewModel({
      run: FAKE_RUN,
      employee: employeeNoData,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
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
      ratesConfig: null,
      employerSignatureBase64: null,
    });

    expect(vm.lugarYFecha).toContain('1 de enero de 2026');
  });

  it('is deterministic given identical inputs (SC3)', () => {
    const input = {
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
    };

    expect(buildReceiptViewModel(input)).toEqual(buildReceiptViewModel(input));
  });

  describe('lugarYFecha (Employer.defaultLugar)', () => {
    it('renders "En <lugar>, a <fecha>" when the employer has a default lugar set', () => {
      const vm = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: { ...FAKE_EMPLOYER, defaultLugar: 'Ciudad de Prueba' },
        issuedOnIso: '2026-01-01',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(vm.lugarYFecha).toBe('En Ciudad de Prueba, a 1 de enero de 2026');
    });

    it('preserves the blank "En ………, a <fecha>" placeholder when defaultLugar is null (backward-compat)', () => {
      const vm = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: { ...FAKE_EMPLOYER, defaultLugar: null },
        issuedOnIso: '2026-01-01',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(vm.lugarYFecha).toBe('En ………, a 1 de enero de 2026');
    });

    it('falls back to the blank placeholder when defaultLugar is an empty or whitespace-only string', () => {
      const vmEmpty = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: { ...FAKE_EMPLOYER, defaultLugar: '' },
        issuedOnIso: '2026-01-01',
        ratesConfig: null,
        employerSignatureBase64: null,
      });
      expect(vmEmpty.lugarYFecha).toBe('En ………, a 1 de enero de 2026');

      const vmWhitespace = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: { ...FAKE_EMPLOYER, defaultLugar: '   ' },
        issuedOnIso: '2026-01-01',
        ratesConfig: null,
        employerSignatureBase64: null,
      });
      expect(vmWhitespace.lugarYFecha).toBe('En ………, a 1 de enero de 2026');
    });
  });

  describe('CCC line (Scenarios 15, 16)', () => {
    it('renders the CCC value with no "verified" claim when present (Scenario 15)', () => {
      const vm = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(vm.empleador.ccc).toBe('28123456789');
    });

    it('renders "—" when the employer has no CCC on file (Scenario 16)', () => {
      const vm = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: { ...FAKE_EMPLOYER, ccc: null },
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(vm.empleador.ccc).toBe('—');
    });
  });

  describe('período literal day-range (Scenarios 12, 13)', () => {
    it('shows the literal day-range when both dates are persisted (Scenario 12)', () => {
      const runWithRange: PayrollRun = { ...FAKE_RUN, periodStartDate: '2026-06-01', periodEndDate: '2026-06-30' };

      const vm = buildReceiptViewModel({
        run: runWithRange,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(vm.periodo.rango).toBe('del día 1 al 30');
      expect(vm.periodo.diasTrabajados).toBe(30);
      expect(vm.periodo.diasNaturales).toBe(30);
    });

    it('is null when either persisted date is null (Scenario 13, NULL-range legacy run)', () => {
      const vmBothNull = buildReceiptViewModel({
        run: FAKE_RUN, // periodStartDate/periodEndDate both null
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });
      expect(vmBothNull.periodo.rango).toBeNull();

      const vmStartOnly = buildReceiptViewModel({
        run: { ...FAKE_RUN, periodStartDate: '2026-06-10', periodEndDate: null },
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });
      expect(vmStartOnly.periodo.rango).toBeNull();
    });

    it('legacy NULL-range run surfaces the persisted daysWorked/daysInMonth directly, no derivation, no crash (Scenario 10)', () => {
      // A run persisted before this slice: no range on the row, its days were
      // computed and stored by the engine at creation time. The view-model
      // MUST read those persisted integers straight from the run -- it never
      // re-derives from a range for legacy rows. Distinctive daysWorked=17
      // proves the number comes from the run, not from any range computation.
      const legacyRun: PayrollRun = {
        ...FAKE_RUN,
        periodStartDate: null,
        periodEndDate: null,
        prorated: true,
        daysWorked: 17,
        daysInMonth: 30,
      };

      const vm = buildReceiptViewModel({
        run: legacyRun,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(vm.periodo.rango).toBeNull();
      expect(vm.periodo.diasTrabajados).toBe(17);
      expect(vm.periodo.diasNaturales).toBe(30);
      expect(vm.periodo.prorrateado).toBe(true);
    });
  });

  describe('worker deduction breakdown by contingency (Scenarios 17, 18)', () => {
    // baseGrossCents=90000 (900,00€) INDEFINIDO full month => retribución
    // 105000 -> tramo 5 (877,01-1.061,00) -> baseCotizacionCents=97000
    // (970,00€); full-month cuota = 970,00 x 6,40% = 62,08€ = 6208 cents
    // (same numbers as engine.test.ts's "full month" proof).
    const fullMonthRun: PayrollRun = {
      ...FAKE_RUN,
      grossCents: cents(90000),
      ssDeductionCents: cents(6208),
      netCents: cents(90000 - 6208),
      extraCents: cents(0),
      prorated: false,
      daysWorked: 30,
      daysInMonth: 30,
    };

    it('itemizes three contingency rows with a shared base and percentage tipo', () => {
      const vm = buildReceiptViewModel({
        run: fullMonthRun,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: RATES_2026,
        employerSignatureBase64: null,
      });

      expect(vm.deduccionesDesglose).toHaveLength(3);
      const [comunes, desempleo, mei] = vm.deduccionesDesglose;

      expect(comunes?.concepto).toBe('Contingencias comunes');
      expect(desempleo?.concepto).toBe('Desempleo');
      expect(mei?.concepto).toBe('MEI (Mecanismo de Equidad Intergeneracional)');

      // Shared base on every row -- full month, so baseMensual === basePeriodo.
      expect(comunes?.baseMensual).toBe(`970,00${NBSP}€`);
      expect(desempleo?.baseMensual).toBe(`970,00${NBSP}€`);
      expect(mei?.baseMensual).toBe(`970,00${NBSP}€`);
      expect(comunes?.basePeriodo).toBe(`970,00${NBSP}€`);
      expect(desempleo?.basePeriodo).toBe(`970,00${NBSP}€`);
      expect(mei?.basePeriodo).toBe(`970,00${NBSP}€`);

      expect(comunes?.tipo).toBe('4,70 %');
      expect(desempleo?.tipo).toBe('1,55 %');
      expect(mei?.tipo).toBe('0,15 %');
    });

    it('sums exactly to the persisted ssDeductionCents via residual-on-largest-line (Scenario 17)', () => {
      const vm = buildReceiptViewModel({
        run: fullMonthRun,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: RATES_2026,
        employerSignatureBase64: null,
      });

      const parseEuros = (amount: string): number =>
        Math.round(Number(amount.replace(NBSP, '').replace('€', '').trim().replace(',', '.')) * 100);
      const sumCents = vm.deduccionesDesglose.reduce((total, row) => total + parseEuros(row.cuota), 0);

      expect(sumCents).toBe(fullMonthRun.ssDeductionCents);
      expect(vm.totalDeducciones).toBe(`62,08${NBSP}€`);
    });

    it('demonstrates the residual reconciliation: naive independent rounding of all three rows would NOT foot to ssDeductionCents (off by one cent), but the actual breakdown does', () => {
      const vm = buildReceiptViewModel({
        run: fullMonthRun,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: RATES_2026,
        employerSignatureBase64: null,
      });

      const [comunes, desempleo, mei] = vm.deduccionesDesglose;
      // A naive independent multiplyByRatio(97000, 470*30, 300000) rounds to
      // 4559 cents, which together with desempleo (1504) + mei (146) sums to
      // 6209 -- ONE CENT more than the persisted 6208. The actual
      // "Contingencias comunes" row absorbs the residual instead (4558), so
      // the column foots exactly.
      expect(comunes?.cuota).toBe(`45,58${NBSP}€`);
      expect(desempleo?.cuota).toBe(`15,04${NBSP}€`);
      expect(mei?.cuota).toBe(`1,46${NBSP}€`);
    });

    it('líquido total reconciles as totalDevengos - totalDeducciones (Scenario 18)', () => {
      const vm = buildReceiptViewModel({
        run: fullMonthRun,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: RATES_2026,
        employerSignatureBase64: null,
      });

      expect(vm.totalDevengos).toBe(`900,00${NBSP}€`);
      expect(vm.totalDeducciones).toBe(`62,08${NBSP}€`);
      expect(vm.liquidoTotal).toBe(`837,92${NBSP}€`);
      expect(fullMonthRun.netCents).toBe(cents(90000 - 6208));
    });

    it('ratesConfig=null degrades to an empty breakdown, no crash (mirrors Scenario 10 NULL-safety)', () => {
      const vm = buildReceiptViewModel({
        run: fullMonthRun,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(vm.deduccionesDesglose).toEqual([]);
      expect(vm.deducciones).toEqual([
        { label: 'Cuota Seguridad Social (persona trabajadora)', amount: `62,08${NBSP}€` },
      ]);
    });
  });

  describe('dual base (baseMensual / basePeriodo) on a partial month (spec R3/S1)', () => {
    // baseGrossCents=122100 (1.221,00€) INDEFINIDO, partial month (9/30 días
    // worked, real daysInMonth=31) => retribución 142450 -> tramo 8 (uncapped)
    // -> baseCotizacionCents=142450 (1.424,50€); basePeriodo = 142450x9/30 =
    // 42735 (427,35€); ssDeductionCents=2735 (same numbers as engine.test.ts's
    // "July partial month" proof).
    const partialEmployee: Employee = { ...FAKE_EMPLOYEE, baseGrossCents: cents(122100) };
    const partialMonthRun: PayrollRun = {
      ...FAKE_RUN,
      grossCents: cents(36630),
      ssDeductionCents: cents(2735),
      netCents: cents(36630 - 2735),
      extraCents: cents(0),
      prorated: true,
      daysWorked: 9,
      daysInMonth: 31,
    };

    it('emits baseMensual (full, informational) and basePeriodo (operative, prorated) on every row', () => {
      const vm = buildReceiptViewModel({
        run: partialMonthRun,
        employee: partialEmployee,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: RATES_2026,
        employerSignatureBase64: null,
      });

      expect(vm.deduccionesDesglose).toHaveLength(3);
      for (const row of vm.deduccionesDesglose) {
        expect(row.baseMensual).toBe(`1424,50${NBSP}€`);
        expect(row.basePeriodo).toBe(`427,35${NBSP}€`);
      }
    });

    it('reconciles basePeriodo x tipo to cuota per row, within the pre-existing 1-cent residual-on-CC tolerance', () => {
      const vm = buildReceiptViewModel({
        run: partialMonthRun,
        employee: partialEmployee,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: RATES_2026,
        employerSignatureBase64: null,
      });

      const parseEuros = (amount: string): number =>
        Math.round(Number(amount.replace(NBSP, '').replace('€', '').trim().replace(/\./g, '').replace(',', '.')) * 100);

      const [comunes, desempleo, mei] = vm.deduccionesDesglose;
      expect(comunes?.tipo).toBe('4,70 %');
      expect(desempleo?.tipo).toBe('1,55 %');
      expect(mei?.tipo).toBe('0,15 %');
      expect(comunes?.cuota).toBe(`20,09${NBSP}€`);
      expect(desempleo?.cuota).toBe(`6,62${NBSP}€`);
      expect(mei?.cuota).toBe(`0,64${NBSP}€`);

      const basePeriodoCents = parseEuros(comunes?.basePeriodo ?? '0');
      for (const row of vm.deduccionesDesglose) {
        expect(Math.abs(parseEuros(row.basePeriodo) - basePeriodoCents)).toBe(0);
      }

      // Column foots exactly to the persisted ssDeductionCents (27,35 €) via
      // residual-on-CC -- the pre-existing tolerance, not new.
      const sumCents = vm.deduccionesDesglose.reduce((total, row) => total + parseEuros(row.cuota), 0);
      expect(sumCents).toBe(partialMonthRun.ssDeductionCents);
      expect(vm.totalDeducciones).toBe(`27,35${NBSP}€`);
    });
  });

  describe('employer signature fields', () => {
    it('forwards a saved signature payload into empleadorFirmaImagenBase64', () => {
      const vm = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: SYNTHETIC_SIGNATURE_PNG_BASE64,
      });

      expect(vm.empleadorFirmaImagenBase64).toBe(SYNTHETIC_SIGNATURE_PNG_BASE64);
      expect(vm.empleadorFirmaLabel).toBe('Firma de la parte empleadora');
    });

    it('forwards null when no signature is saved', () => {
      const vm = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(vm.empleadorFirmaImagenBase64).toBeNull();
      expect(vm.empleadorFirmaLabel).toBe('Firma de la parte empleadora');
    });

    it('leaves the worker firmaLabel unchanged in both states', () => {
      const withSignature = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: SYNTHETIC_SIGNATURE_PNG_BASE64,
      });
      const withoutSignature = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
        employerSignatureBase64: null,
      });

      expect(withSignature.firmaLabel).toBe('Firma de la persona trabajadora');
      expect(withoutSignature.firmaLabel).toBe('Firma de la persona trabajadora');
    });
  });

  describe('employer contribution block (REQ-V1, V3, V4, V5)', () => {
    // Real monetary amounts are fine in fixtures (CLAUDE.md §5); identifiers stay fake.
    // G-1221: baseGross 1.221,00 -> retribución 1.424,50 -> tramo 8, base 1.424,50.
    // Worker cuota full month = 6,40 % x 1.424,50 = 91,17 (TGSS golden vector).
    const eur = (amount: string): string => `${amount}${NBSP}€`;

    const employeeG1221: Employee = { ...FAKE_EMPLOYEE, baseGrossCents: cents(122100) };
    const employeeG800: Employee = { ...FAKE_EMPLOYEE, baseGrossCents: cents(80000) };

    const runG1221FullMonth: PayrollRun = {
      ...FAKE_RUN,
      grossCents: cents(122100),
      ssDeductionCents: cents(9117),
      netCents: cents(122100 - 9117),
      extraCents: cents(0),
      prorated: false,
      daysWorked: 30,
      daysInMonth: 30,
    };
    // G-800: retribución 933,33 -> tramo 5 -> base 970,00; worker cuota 6,40 % = 62,08.
    const runG800FullMonth: PayrollRun = {
      ...runG1221FullMonth,
      grossCents: cents(80000),
      ssDeductionCents: cents(6208),
      netCents: cents(80000 - 6208),
    };
    // G-1221 prorated 9/30 (real month 31 days): worker cuota 27,35.
    const runG1221Partial9: PayrollRun = {
      ...runG1221FullMonth,
      grossCents: cents(36630),
      ssDeductionCents: cents(2735),
      netCents: cents(36630 - 2735),
      prorated: true,
      daysWorked: 9,
      daysInMonth: 31,
    };

    const build = (run: PayrollRun, employee: Employee, ratesConfig: RatesConfig | null = RATES_2026) =>
      buildReceiptViewModel({
        run,
        employee,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig,
        employerSignatureBase64: null,
      }).empleadorCotizacion;

    describe('with verified figures', () => {
      it('renders the golden vector in display order with labels, tipos and cuotas (D3.1, V1.1)', () => {
        const block = build(runG1221FullMonth, employeeG1221);
        if (block.kind !== 'figures') throw new Error(`expected figures, got ${block.reason}`);

        expect(block.filas).toEqual([
          { concepto: 'Contingencias comunes', basePeriodo: eur('1424,50'), tipo: '23,60 %', cuota: eur('336,18') },
          { concepto: 'Contingencias profesionales (AT y EP)', basePeriodo: eur('1424,50'), tipo: '1,50 %', cuota: eur('21,37') },
          { concepto: 'Desempleo', basePeriodo: eur('1424,50'), tipo: '5,50 %', cuota: eur('78,35') },
          { concepto: 'FOGASA (Fondo de Garantía Salarial)', basePeriodo: eur('1424,50'), tipo: '0,20 %', cuota: eur('2,85') },
          {
            concepto: 'MEI (Mecanismo de Equidad Intergeneracional)',
            basePeriodo: eur('1424,50'),
            tipo: '0,75 %',
            cuota: eur('10,68'),
          },
        ]);
        expect(block.totalNominal).toBe(eur('449,43'));
        expect(block.totalEfectivo).toBe(eur('317,23'));
      });

      it('puts the minus sign on the benefit rows only, and the operand of each is a cuota (V1.2)', () => {
        const block = build(runG1221FullMonth, employeeG1221);
        if (block.kind !== 'figures') throw new Error(`expected figures, got ${block.reason}`);

        expect(block.beneficios).toEqual([
          { concepto: 'Reducción por contingencias comunes', cuotaAfectada: eur('336,18'), tipo: '20 %', importe: `-${eur('67,24')}` },
          { concepto: 'Bonificación por desempleo y FOGASA', cuotaAfectada: eur('81,20'), tipo: '80 %', importe: `-${eur('64,96')}` },
        ]);
        // MEI and AT y EP carry no benefit: no benefit row names them.
        for (const row of block.beneficios) {
          expect(row.concepto).not.toMatch(/MEI|AT y EP/);
        }
        // No nominal amount, and neither total, is negative.
        for (const row of block.filas) {
          expect(row.cuota.startsWith('-')).toBe(false);
        }
        expect(block.totalNominal.startsWith('-')).toBe(false);
        expect(block.totalEfectivo.startsWith('-')).toBe(false);
      });

      it('uses the TEMPORAL desempleo tipo and figures (D5.1, V1.3)', () => {
        // Worker cuota TEMPORAL: (4,70 + 1,60 + 0,15) % x 1.424,50 = 91,88.
        const block = build(
          { ...runG1221FullMonth, ssDeductionCents: cents(9188), netCents: cents(122100 - 9188) },
          { ...employeeG1221, contractType: 'TEMPORAL' },
        );
        if (block.kind !== 'figures') throw new Error(`expected figures, got ${block.reason}`);

        expect(block.filas[2]).toEqual({
          concepto: 'Desempleo',
          basePeriodo: eur('1424,50'),
          tipo: '6,70 %',
          cuota: eur('95,44'),
        });
        expect(block.totalNominal).toBe(eur('466,52'));
        expect(block.beneficios[1]?.importe).toBe(`-${eur('78,63')}`);
        expect(block.totalEfectivo).toBe(eur('320,65'));
      });

      it('shows the prorated base and the 9/30 figures on a partial month (D6.1, V4.4)', () => {
        const block = build(runG1221Partial9, employeeG1221);
        if (block.kind !== 'figures') throw new Error(`expected figures, got ${block.reason}`);

        expect(block.filas.map((row) => row.basePeriodo)).toEqual(Array(5).fill(eur('427,35')));
        expect(block.filas.map((row) => row.cuota)).toEqual([
          eur('100,85'),
          eur('6,41'),
          eur('23,50'),
          eur('0,85'),
          eur('3,21'),
        ]);
        expect(block.totalNominal).toBe(eur('134,82'));
        // R-B2: 80 % of the PRINTED 23,50 + 0,85 = 24,35 is 19,48 (R-B1 would print 19,49).
        expect(block.beneficios[0]).toMatchObject({ cuotaAfectada: eur('100,85'), importe: `-${eur('20,17')}` });
        expect(block.beneficios[1]).toMatchObject({ cuotaAfectada: eur('24,35'), importe: `-${eur('19,48')}` });
        expect(block.totalEfectivo).toBe(eur('95,17'));
      });

      it('uses 30/30 for a non-prorated run in a 31-day month, never 31/30 (D6.2)', () => {
        const block = build(
          { ...runG1221FullMonth, daysWorked: 31, daysInMonth: 31 },
          employeeG1221,
        );
        if (block.kind !== 'figures') throw new Error(`expected figures, got ${block.reason}`);

        expect(block.filas[0]?.cuota).toBe(eur('336,18'));
        expect(block.totalNominal).toBe(eur('449,43'));
        expect(block.totalEfectivo).toBe(eur('317,23'));
      });

      it('is verified on a same-base run: G-800 yields the D3.4 figures (V4.1)', () => {
        const block = build(runG800FullMonth, employeeG800);
        if (block.kind !== 'figures') throw new Error(`expected figures, got ${block.reason}`);

        expect(block.filas.map((row) => row.cuota)).toEqual([
          eur('228,92'),
          eur('14,55'),
          eur('53,35'),
          eur('1,94'),
          eur('7,28'),
        ]);
        expect(block.totalNominal).toBe(eur('306,04'));
        expect(block.beneficios.map((row) => row.importe)).toEqual([`-${eur('45,78')}`, `-${eur('44,23')}`]);
        expect(block.totalEfectivo).toBe(eur('216,03'));
      });

      it('treats a same-tramo salary edit as a true negative: base 970,00 figures stay (V4.3)', () => {
        // 800,00 -> 850,00: retribución 991,67, still tramo 5, so base 970,00
        // and every receipt figure is genuinely unchanged.
        const block = build(runG800FullMonth, { ...FAKE_EMPLOYEE, baseGrossCents: cents(85000) });
        if (block.kind !== 'figures') throw new Error(`expected figures, got ${block.reason}`);

        expect(block.filas[0]?.basePeriodo).toBe(eur('970,00'));
        expect(block.totalEfectivo).toBe(eur('216,03'));
      });

      it('never prints "-0,00" on a zero-day run, which is still verified (persisted 0 and recompute 0)', () => {
        const zeroDaysRun: PayrollRun = {
          ...runG1221Partial9,
          grossCents: cents(0),
          ssDeductionCents: cents(0),
          netCents: cents(0),
          daysWorked: 0,
        };
        const block = build(zeroDaysRun, employeeG1221);
        if (block.kind !== 'figures') throw new Error(`expected figures, got ${block.reason}`);

        expect(block.beneficios.map((row) => row.importe)).toEqual([eur('0,00'), eur('0,00')]);
        expect(block.totalEfectivo).toBe(eur('0,00'));
      });
    });

    describe('with no employer figures', () => {
      it('carries a note and NO rows or totals when ratesConfig is null; the lump line still renders (V3.1)', () => {
        const vm = buildReceiptViewModel({
          run: runG1221FullMonth,
          employee: employeeG1221,
          employer: FAKE_EMPLOYER,
          issuedOnIso: '2026-08-04',
          ratesConfig: null,
          employerSignatureBase64: null,
        });

        expect(vm.empleadorCotizacion.kind).toBe('unavailable');
        if (vm.empleadorCotizacion.kind !== 'unavailable') return;
        expect(vm.empleadorCotizacion.reason).toBe('rates_unavailable');
        expect(vm.empleadorCotizacion.nota).not.toBe('');
        expect(vm.empleadorCotizacion).not.toHaveProperty('filas');
        expect(vm.empleadorCotizacion).not.toHaveProperty('totalEfectivo');
        expect(vm.deducciones).toEqual([
          { label: 'Cuota Seguridad Social (persona trabajadora)', amount: eur('91,17') },
        ]);
      });

      it('flags drift across a tramo and shows a note instead of any figure (V4.2, V5.2)', () => {
        // The run was created from G-800 (cuota 62,08); the employee is then
        // edited to G-1221, whose current worker cuota is 91,17.
        const block = build(runG800FullMonth, employeeG1221);

        expect(block.kind).toBe('unavailable');
        if (block.kind !== 'unavailable') return;
        expect(block.reason).toBe('base_drifted');
        expect(block.nota).not.toBe('');
        expect(block).not.toHaveProperty('filas');
        expect(block).not.toHaveProperty('beneficios');
        expect(JSON.stringify(block)).not.toContain('317,23');
        // The drift note does not claim any figure is shown.
        expect(block.nota).not.toContain('recalcul');
      });

      it('flags drift on a prorated run whose persisted cuota is the full-month one (detector mirrors the days normalization)', () => {
        // Same persisted 91,17 as a full month, but the run says 9 days worked:
        // the recompute at 9/30 gives 27,35, so this is a real mismatch.
        const block = build({ ...runG1221FullMonth, prorated: true, daysWorked: 9, daysInMonth: 31 }, employeeG1221);

        expect(block.kind === 'unavailable' && block.reason).toBe('base_drifted');
      });

      it('does not mistake a non-prorated run for a prorated one because daysWorked is not 30', () => {
        // A non-prorated run normalizes to 30 whatever `daysWorked` holds, so it
        // must stay verified; a detector reading `daysWorked` raw would drift.
        const block = build({ ...runG1221FullMonth, daysWorked: 31, daysInMonth: 31 }, employeeG1221);

        expect(block.kind).toBe('figures');
      });

      it('also flags drift when a rate for an already-run year is corrected (accepted behaviour)', () => {
        // A correction to SS_RATES_BY_YEAR means the printed figures no longer
        // match what was filed. The detector reports it rather than hiding it.
        const correctedRates: RatesConfig = { ...RATES_2026, worker: { ...RATES_2026.worker, ccPer10000: 480 } };

        const block = build(runG1221FullMonth, employeeG1221, correctedRates);

        expect(block.kind === 'unavailable' && block.reason).toBe('base_drifted');
      });
    });

    describe('legacy runs (V5.1)', () => {
      // A pre-migration-0002 run: SS cuota typed by hand (7,94), day columns
      // backfilled to 0. `daysInMonth: 0` is what makes it PROVABLY legacy
      // (the engine never emits 0); without it the same run is `drifted`.
      const legacyRun: PayrollRun = {
        ...runG1221FullMonth,
        grossCents: cents(36630),
        ssDeductionCents: cents(794),
        netCents: cents(36630 - 794),
        prorated: true,
        daysWorked: 0,
        daysInMonth: 0,
      };

      it('is not verifiable: no drift note, no employer rows or totals', () => {
        const block = build(legacyRun, employeeG1221);

        expect(block.kind).toBe('unavailable');
        if (block.kind !== 'unavailable') return;
        expect(block.reason).toBe('base_not_verifiable');
        expect(block).not.toHaveProperty('filas');
        expect(block).not.toHaveProperty('totalEfectivo');
        // The recompute differs from the typed 7,94, which is exactly the
        // condition that must NOT be reported as drift.
        const driftNota = build(runG800FullMonth, employeeG1221);
        expect(driftNota.kind === 'unavailable' && driftNota.nota).not.toBe(block.nota);
        // Wording must not imply that figures were recalculated and printed.
        expect(block.nota).not.toContain('recalcul');
      });

      it('is identical across repeated builds', () => {
        expect(build(legacyRun, employeeG1221)).toEqual(build(legacyRun, employeeG1221));
      });

      it('falls to drifted, not legacy, once it carries day data (the accepted residual band)', () => {
        // Manual-era run that does carry real day data: the typed cuota cannot
        // be told from a moved base, and the employer block would be computed
        // from a different source than the worker cuota above it.
        const block = build({ ...legacyRun, daysWorked: 9, daysInMonth: 31 }, employeeG1221);

        expect(block.kind === 'unavailable' && block.reason).toBe('base_drifted');
      });

      it('treats a persisted cuota of 0 as an absent input, not a moved base', () => {
        const block = build({ ...runG1221FullMonth, ssDeductionCents: cents(0) }, employeeG1221);

        expect(block.kind === 'unavailable' && block.reason).toBe('base_not_verifiable');
      });
    });

    it('does not change the worker desglose rows on a non-prorated run (resolveSsDaysWorked extraction)', () => {
      const vm = buildReceiptViewModel({
        run: { ...runG1221FullMonth, daysWorked: 31, daysInMonth: 31 },
        employee: employeeG1221,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: RATES_2026,
        employerSignatureBase64: null,
      });

      expect(vm.deduccionesDesglose.map((row) => row.cuota)).toEqual([eur('66,95'), eur('22,08'), eur('2,14')]);
    });

    it('is deterministic with figures present', () => {
      expect(build(runG1221FullMonth, employeeG1221)).toEqual(build(runG1221FullMonth, employeeG1221));
    });

    describe('cotización anchors on the run (spec B1-B5)', () => {
      // The same G-1221 full month, but recorded WITH the inputs it was
      // computed from: base 1.424,50 and an INDEFINIDO contract.
      const anchoredRun: PayrollRun = {
        ...runG1221FullMonth,
        baseCotizacionCents: cents(142450),
        contractType: 'INDEFINIDO',
      };

      const vm = (run: PayrollRun, employee: Employee, ratesConfig: RatesConfig | null = RATES_2026) =>
        buildReceiptViewModel({
          run,
          employee,
          employer: FAKE_EMPLOYER,
          issuedOnIso: '2026-08-04',
          ratesConfig,
          employerSignatureBase64: null,
        });

      it('reprints unchanged after a cross-tramo salary rise (B1.1)', () => {
        const atPrintTime = vm(anchoredRun, employeeG1221);

        // The employee is later raised to 2.000,00/month: retribución 2.333,33,
        // a different tramo-8 base entirely.
        const raised: Employee = { ...employeeG1221, baseGrossCents: cents(200000) };
        const reprinted = vm(anchoredRun, raised);

        expect(reprinted).toEqual(atPrintTime);
        expect(reprinted.empleadorCotizacion.kind).toBe('figures');
        // Still the original golden vector, not the raised salary's figures.
        expect(reprinted.empleadorCotizacion.kind === 'figures' && reprinted.empleadorCotizacion.totalEfectivo).toBe(
          eur('317,23'),
        );
      });

      it('reprints unchanged after the contract type is flipped to TEMPORAL (B1.2)', () => {
        const atPrintTime = vm(anchoredRun, employeeG1221);
        const flipped: Employee = { ...employeeG1221, contractType: 'TEMPORAL' };

        const reprinted = vm(anchoredRun, flipped);

        expect(reprinted).toEqual(atPrintTime);
        // The INDEFINIDO employer desempleo rate, not the TEMPORAL 6,70 %.
        const block = reprinted.empleadorCotizacion;
        expect(block.kind === 'figures' && block.filas[2]?.tipo).toBe('5,50 %');
      });

      it('without the anchor the SAME edit pins the figures to the EMPLOYEE current base (the defect)', () => {
        const raised: Employee = { ...employeeG1221, baseGrossCents: cents(200000) };
        const unanchored = vm(runG1221FullMonth, raised); // run has null anchors

        // Not merely "different": the fallback follows the employee to base
        // 2.333,33, so the desglose rows are that base's figures while the
        // total still foots to the period's persisted 91,17.
        expect(unanchored.deduccionesDesglose[0]?.baseMensual).toBe(eur('2333,33'));
        expect(unanchored.totalDeducciones).toBe(eur('91,17'));
        // The anchored build of the same run stays on the period's own base.
        expect(vm(anchoredRun, raised).deduccionesDesglose[0]?.baseMensual).toBe(eur('1424,50'));
      });

      it('reprints unchanged from a TEMPORAL anchor even when the employee is now INDEFINIDO', () => {
        // The reverse of B1.2: the anchor must supply the 6,70 % employer
        // desempleo rate, not the employee's current 5,50 %.
        const temporalRun: PayrollRun = {
          ...anchoredRun,
          contractType: 'TEMPORAL',
          ssDeductionCents: cents(9188), // 6,45 % x 1.424,50, the TEMPORAL cuota
          netCents: cents(122100 - 9188),
        };

        const block = vm(temporalRun, employeeG1221).empleadorCotizacion; // employee is INDEFINIDO

        expect(block.kind).toBe('figures');
        expect(block.kind === 'figures' && block.filas[2]?.tipo).toBe('6,70 %');
      });

      it('falls back per input in the other direction too: a contract anchor alone still uses it', () => {
        const contractOnly: PayrollRun = {
          ...runG1221FullMonth,
          baseCotizacionCents: null,
          contractType: 'TEMPORAL',
          ssDeductionCents: cents(9188),
          netCents: cents(122100 - 9188),
        };

        // Base falls back to the employee's current G-1221 (same 1.424,50),
        // while the TEMPORAL anchor drives the rate.
        const block = vm(contractOnly, employeeG1221).empleadorCotizacion;
        expect(block.kind === 'figures' && block.filas[2]?.tipo).toBe('6,70 %');
      });

      it('stops the contingencias comunes row from absorbing base drift (B2.1)', () => {
        // Anchored: every row is its own rate applied to the period base, and
        // the column still foots to the persisted 91,17.
        const anchored = vm(anchoredRun, employeeG800).deduccionesDesglose;
        expect(anchored.map((row) => row.cuota)).toEqual([eur('66,95'), eur('22,08'), eur('2,14')]);
        // 66,95 is exactly 4,70 % x 1.424,50 -- a real CC figure, not a residual.

        // The same run WITHOUT anchors, with the employee now on G-800: the
        // rows are computed from base 970,00 while the total stays 91,17, so
        // contingencias comunes silently swallows the 29,08 difference.
        const drifting = vm(runG1221FullMonth, employeeG800).deduccionesDesglose;
        expect(drifting.map((row) => row.cuota)).toEqual([eur('74,67'), eur('15,04'), eur('1,46')]);
        // 74,67 against a true 4,70 % x 970,00 = 45,59. That is the defect.
      });

      it('still reports a rate correction for an already-run year (B4.2)', () => {
        const correctedRates: RatesConfig = { ...RATES_2026, worker: { ...RATES_2026.worker, ccPer10000: 480 } };

        const block = vm(anchoredRun, employeeG1221, correctedRates).empleadorCotizacion;

        expect(block.kind === 'unavailable' && block.reason).toBe('base_drifted');
      });

      it('an anchor does NOT override the provable-legacy guard (B5.1)', () => {
        // daysInMonth 0 means the persisted cuota was typed by hand. That stays
        // true however the base is resolved, so the guard outranks the anchor.
        const legacyWithAnchor: PayrollRun = {
          ...anchoredRun,
          ssDeductionCents: cents(794),
          prorated: true,
          daysWorked: 0,
          daysInMonth: 0,
        };

        const block = vm(legacyWithAnchor, employeeG1221).empleadorCotizacion;

        expect(block.kind === 'unavailable' && block.reason).toBe('base_not_verifiable');
      });

      it('falls back per input: a base anchor alone still honours the stored contract type being absent', () => {
        const baseOnly: PayrollRun = { ...runG1221FullMonth, baseCotizacionCents: cents(142450), contractType: null };

        // Contract type falls back to the employee's current INDEFINIDO, so the
        // run still verifies and prints the golden vector.
        const block = vm(baseOnly, employeeG1221).empleadorCotizacion;
        expect(block.kind === 'figures' && block.totalEfectivo).toBe(eur('317,23'));
      });

      describe('the employer total anchor', () => {
        // The same anchored G-1221 month, now also recording the employer
        // cuota efectiva it was settled with: 449,43 nominal - 67,24 - 64,96.
        const employerAnchoredRun: PayrollRun = { ...anchoredRun, employerTotalEfectivoCents: cents(31723) };

        // A correction to the employer contingencias comunes rate for an
        // already-settled year: 23,60 % -> 23,70 %. The WORKER cuota is
        // untouched by it, which is what made this invisible before.
        const correctedEmployerRates: RatesConfig = {
          ...RATES_2026,
          employer: { ...RATES_2026.employer, ccPer10000: 2370 },
        };

        it('reports drift when an employer rate for an already-settled year is corrected', () => {
          const block = vm(employerAnchoredRun, employeeG1221, correctedEmployerRates).empleadorCotizacion;

          expect(block.kind).toBe('unavailable');
          if (block.kind !== 'unavailable') return;
          expect(block.reason).toBe('base_drifted');
          // Neither the old figure nor the one the corrected rates would print.
          expect(JSON.stringify(block)).not.toContain('317,23');
          expect(JSON.stringify(block)).not.toContain('318,38'); // what 23,70 % would have printed
        });

        it('is exactly what the worker comparison cannot see: that same run still verifies on the worker side', () => {
          // The run WITHOUT the employer anchor, same corrected employer rates:
          // the worker recompute still matches 91,17, so the figures reprint --
          // silently, at the new rates. This is the defect, pinned on both sides.
          const block = vm(anchoredRun, employeeG1221, correctedEmployerRates).empleadorCotizacion;

          expect(block.kind).toBe('figures');
          expect(block.kind === 'figures' && block.filas[0]?.tipo).toBe('23,70 %');
          expect(block.kind === 'figures' && block.totalEfectivo).toBe(eur('318,38')); // not the 317,23 that was filed
        });

        it('prints the figures when the anchor still agrees with the recompute', () => {
          const block = vm(employerAnchoredRun, employeeG1221).empleadorCotizacion;

          expect(block.kind === 'figures' && block.totalEfectivo).toBe(eur('317,23'));
        });

        it('leaves the view-model identical to the same run without the employer anchor', () => {
          // The anchor is a check, not an input: it must change nothing on a
          // receipt that was already correct.
          expect(vm(employerAnchoredRun, employeeG1221)).toEqual(vm(anchoredRun, employeeG1221));
        });

        it('reports drift when the stored employer total simply does not match, worker side notwithstanding', () => {
          const wrongTotal: PayrollRun = { ...employerAnchoredRun, employerTotalEfectivoCents: cents(31722) };

          const block = vm(wrongTotal, employeeG1221).empleadorCotizacion;

          expect(block.kind === 'unavailable' && block.reason).toBe('base_drifted');
        });

        it('compares a zero employer anchor instead of skipping it (pins `!== null`, not a truthy check)', () => {
          // A full month whose stored employer total is 0 against a recompute
          // of 317,23. A NULL check reports this; a truthiness check
          // (`if (run.employerTotalEfectivoCents)`) would read 0 as falsy,
          // skip the comparison entirely and reprint the figures.
          //
          // The zero-day case below cannot pin that choice, because there the
          // anchor and the recompute are both 0 and either reading verifies.
          const zeroAnchorFullMonth: PayrollRun = { ...anchoredRun, employerTotalEfectivoCents: cents(0) };

          const block = vm(zeroAnchorFullMonth, employeeG1221).empleadorCotizacion;

          expect(block.kind === 'unavailable' && block.reason).toBe('base_drifted');
        });

        it('stays verified on a zero-day run, where the anchor and the recompute are both 0', () => {
          // A zero-day run costs the employer nothing and recomputes to zero,
          // so the two agree. This case cannot distinguish a null check from a
          // truthiness check -- the test above does that; what it pins is that
          // agreement at zero verifies rather than reporting drift.
          const zeroDaysRun: PayrollRun = {
            ...anchoredRun,
            grossCents: cents(0),
            ssDeductionCents: cents(0),
            netCents: cents(0),
            prorated: true,
            daysWorked: 0,
            daysInMonth: 31,
            employerTotalEfectivoCents: cents(0),
          };

          const block = vm(zeroDaysRun, employeeG1221).empleadorCotizacion;

          expect(block.kind === 'figures' && block.totalEfectivo).toBe(eur('0,00'));
        });

        it('does not override the provable-legacy guard either', () => {
          // daysInMonth 0 still outranks every anchor: the comparison is
          // meaningless there, not merely wrong.
          const legacyWithEmployerAnchor: PayrollRun = {
            ...employerAnchoredRun,
            ssDeductionCents: cents(794),
            prorated: true,
            daysWorked: 0,
            daysInMonth: 0,
          };

          const block = vm(legacyWithEmployerAnchor, employeeG1221).empleadorCotizacion;

          expect(block.kind === 'unavailable' && block.reason).toBe('base_not_verifiable');
        });

        it('still reports a WORKER rate correction, as it did before the employer anchor existed', () => {
          const correctedWorkerRates: RatesConfig = { ...RATES_2026, worker: { ...RATES_2026.worker, ccPer10000: 480 } };

          const block = vm(employerAnchoredRun, employeeG1221, correctedWorkerRates).empleadorCotizacion;

          expect(block.kind === 'unavailable' && block.reason).toBe('base_drifted');
        });

        it('follows the employer anchor through a TEMPORAL contract anchor, not the employee current one', () => {
          const temporalRun: PayrollRun = {
            ...employerAnchoredRun,
            contractType: 'TEMPORAL',
            ssDeductionCents: cents(9188),
            netCents: cents(122100 - 9188),
            employerTotalEfectivoCents: cents(32065), // the 6,70 % desempleo variant
          };

          const block = vm(temporalRun, employeeG1221).empleadorCotizacion; // employee is INDEFINIDO

          expect(block.kind === 'figures' && block.totalEfectivo).toBe(eur('320,65'));
        });

        it('checks a pre-anchor run exactly as before: no employer anchor, no employer comparison', () => {
          // A run saved before the column existed holds null (no backfill), so
          // the corrected employer rates reprint just as they did yesterday.
          // Documenting the residual, not endorsing it.
          const block = vm(runG1221FullMonth, employeeG1221, correctedEmployerRates).empleadorCotizacion;

          expect(block.kind).toBe('figures');
        });
      });

      it('anchoring a run to the values it already recomputed to changes nothing (B3.1)', () => {
        // An un-edited employee makes the fallback and the anchor agree, so the
        // two builds must be indistinguishable. This is what makes the anchor a
        // no-op for every receipt that was already correct.
        const nullAnchors = vm(runG1221FullMonth, employeeG1221);
        const anchoredWithTheSameValues = vm(anchoredRun, employeeG1221);

        expect(nullAnchors).toEqual(anchoredWithTheSameValues);
      });
    });
  });
});
