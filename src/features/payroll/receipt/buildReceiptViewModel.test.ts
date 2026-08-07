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
      });
      expect(vmEmpty.lugarYFecha).toBe('En ………, a 1 de enero de 2026');

      const vmWhitespace = buildReceiptViewModel({
        run: FAKE_RUN,
        employee: FAKE_EMPLOYEE,
        employer: { ...FAKE_EMPLOYER, defaultLugar: '   ' },
        issuedOnIso: '2026-01-01',
        ratesConfig: null,
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
      });
      expect(vmBothNull.periodo.rango).toBeNull();

      const vmStartOnly = buildReceiptViewModel({
        run: { ...FAKE_RUN, periodStartDate: '2026-06-10', periodEndDate: null },
        employee: FAKE_EMPLOYEE,
        employer: FAKE_EMPLOYER,
        issuedOnIso: '2026-08-04',
        ratesConfig: null,
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
      });

      expect(vm.deduccionesDesglose).toHaveLength(3);
      const [comunes, desempleo, mei] = vm.deduccionesDesglose;

      expect(comunes?.concepto).toBe('Contingencias comunes');
      expect(desempleo?.concepto).toBe('Desempleo');
      expect(mei?.concepto).toBe('MEI (Mecanismo de Equidad Intergeneracional)');

      // Shared base on every row.
      expect(comunes?.base).toBe(`970,00${NBSP}€`);
      expect(desempleo?.base).toBe(`970,00${NBSP}€`);
      expect(mei?.base).toBe(`970,00${NBSP}€`);

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
      });

      expect(vm.deduccionesDesglose).toEqual([]);
      expect(vm.deducciones).toEqual([
        { label: 'Cuota Seguridad Social (persona trabajadora)', amount: `62,08${NBSP}€` },
      ]);
    });
  });
});
