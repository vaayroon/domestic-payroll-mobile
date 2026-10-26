/**
 * Render test for `usePayrollRunForm` (spec "Payroll Run Screen" + spec
 * "PayrollRun consumes computed SS, not manual entry"): the SS preview is
 * COMPUTED automatically (no manual SS input exists anymore), the
 * duplicate-period guard blocks `create()` with a clear Spanish message, the
 * happy path persists the engine's exact computed fields, and a zero-run-days
 * run with a non-zero semester extra still previews correctly (spec
 * "Zero-Days-Worked Safety" / decision #674). Exercised against
 * `InMemoryEmployeeRepository`/`InMemoryEmployerRepository` (reused from the
 * employees feature's testing fakes -- test code only, never production
 * code, see decision #679) and `InMemoryPayrollRunRepository` (this feature)
 * through the same provider-injection pattern as `useEmployeeForm.test.tsx`.
 *
 * SS math reference (base gross 900,00 EUR, INDEFINIDO, full month): retribución
 * = 900,00 x14/12 = 1.050,00 -> tramo 5 (877,01-1.061,00) -> base 970,00;
 * cuota = 970,00 x 6,40% = 62,08 EUR (6208 cents). Net = 900,00 - 62,08 = 837,92.
 */

import { act, create } from 'react-test-renderer';

import { CurrentEmployerProvider, RepositoryProvider, type Repositories } from '@/core';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import { FAKE_EMPLOYER } from '@/features/employees/testing/fixtures';
import type { Employee, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { usePayrollRunForm, type UsePayrollRunFormResult } from './usePayrollRunForm';
import { InMemoryPayrollRunRepository } from '../testing/fakes';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).

const FAKE_EMPLOYEE: Employee = {
  id: 'employee-fake-1',
  employerId: FAKE_EMPLOYER.id,
  name: 'Empleada de Prueba',
  nif: null,
  naf: null,
  baseGrossCents: cents(90000),
  active: true,
  altaDate: null,
  bajaDate: null,
  contractType: 'INDEFINIDO',
};

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

const fakeSettingsRepository: SettingsRepository = {
  get: notImplemented('SettingsRepository.get'),
  set: notImplemented('SettingsRepository.set'),
};

function HookHarness({ onResult }: { onResult: (result: UsePayrollRunFormResult) => void }) {
  const result = usePayrollRunForm();
  onResult(result);
  return null;
}

async function renderUsePayrollRunForm(employees: Employee[], payrollRunRepository: InMemoryPayrollRunRepository) {
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([FAKE_EMPLOYER]),
    employees: new InMemoryEmployeeRepository(employees),
    payrollRuns: payrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let latest!: UsePayrollRunFormResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <HookHarness onResult={(result) => (latest = result)} />
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  // Flush bootstrap + employee-list load microtasks, plus the auto-select effect.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get current(): UsePayrollRunFormResult {
      return latest;
    },
  };
}

describe('usePayrollRunForm', () => {
  it('auto-selects the first employee and computes the SS preview automatically (no manual SS input)', async () => {
    const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], new InMemoryPayrollRunRepository());

    expect(harness.current.selectedEmployeeId).toBe(FAKE_EMPLOYEE.id);
    expect(harness.current.ratesWarning).toBeNull();
    expect(harness.current.preview).not.toBeNull();
    expect(harness.current.preview?.grossCents).toBe(cents(90000));
    expect(harness.current.preview?.ssDeductionCents).toBe(cents(6208));
    expect(harness.current.preview?.netCents).toBe(cents(83792));
    expect(harness.current.preview?.prorated).toBe(false);
  });

  it('persists the engine-computed fields exactly on submit when no duplicate exists', async () => {
    const payrollRunRepository = new InMemoryPayrollRunRepository();
    const createSpy = jest.spyOn(payrollRunRepository, 'create');
    const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], payrollRunRepository);

    let success = false;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(true);
    expect(createSpy).toHaveBeenCalledWith({
      employeeId: FAKE_EMPLOYEE.id,
      periodYear: harness.current.periodYear,
      periodMonth: harness.current.periodMonth,
      grossCents: cents(90000),
      ssDeductionCents: cents(6208),
      netCents: cents(83792),
      prorated: false,
      extraCents: harness.current.preview?.extraCents,
      daysWorked: harness.current.preview?.daysWorked,
      daysInMonth: harness.current.preview?.daysInMonth,
      periodStartDate: harness.current.periodStartDate,
      periodEndDate: harness.current.periodEndDate,
    });
    expect(harness.current.error).toBeNull();
  });

  it('blocks create() and shows a Spanish message when a run already exists for the period', async () => {
    const { periodYear: year, periodMonth: month } = await (async () => {
      const probe = await renderUsePayrollRunForm([FAKE_EMPLOYEE], new InMemoryPayrollRunRepository());
      return probe.current;
    })();

    const payrollRunRepository = new InMemoryPayrollRunRepository([
      {
        id: 'payroll-run-fake-existing',
        employeeId: FAKE_EMPLOYEE.id,
        periodYear: year,
        periodMonth: month,
        grossCents: cents(90000),
        ssDeductionCents: cents(10000),
        netCents: cents(80000),
        prorated: false,
        extraCents: cents(0),
        daysWorked: 30,
        daysInMonth: 30,
        periodStartDate: null,
        periodEndDate: null,
        baseCotizacionCents: null,
        contractType: null,
        createdAt: 0,
      },
    ]);
    const createSpy = jest.spyOn(payrollRunRepository, 'create');
    const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], payrollRunRepository);

    let success = true;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
    expect(harness.current.error).toMatch(/Ya existe una nómina/);
  });

  it('previews net = extra for a zero-run-days month with non-zero semester extra (decision #674)', async () => {
    // Alta/baja fully inside Jan-Jun 2026 (H1 semester) but before the June
    // run period itself -- gross/SS on the run month are 0, but the June
    // pagas-extra lump is still owed for the semester actually worked.
    const employeeGoneBeforeJune: Employee = {
      ...FAKE_EMPLOYEE,
      altaDate: '2026-02-01',
      bajaDate: '2026-04-30',
    };
    const harness = await renderUsePayrollRunForm([employeeGoneBeforeJune], new InMemoryPayrollRunRepository());

    await act(async () => {
      harness.current.setExtraPayMode('INCLUDE_IN_MONTH');
    });

    // Force the run period to June 2026 regardless of "today".
    while (harness.current.periodMonth !== 6 || harness.current.periodYear !== 2026) {
      const goingUp = harness.current.periodYear < 2026 || (harness.current.periodYear === 2026 && harness.current.periodMonth < 6);
      await act(async () => {
        if (goingUp) {
          harness.current.incrementMonth();
        } else {
          harness.current.decrementMonth();
        }
      });
    }

    expect(harness.current.preview).not.toBeNull();
    expect(harness.current.preview?.grossCents).toBe(cents(44254));
    expect(harness.current.preview?.ssDeductionCents).toBe(cents(0));
    expect(harness.current.preview?.netCents).toBe(cents(44254));
    expect(harness.current.preview?.prorated).toBe(true);
  });

  describe('period-range prefill (spec Scenarios 3, 4, 5)', () => {
    it('prefills the full month when altaDate/bajaDate are both null (Scenario 3)', async () => {
      const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], new InMemoryPayrollRunRepository());
      const { periodYear, periodMonth } = harness.current;
      const totalDays = new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate();
      const pad = (n: number) => String(n).padStart(2, '0');

      expect(harness.current.periodStartDate).toBe(`${periodYear}-${pad(periodMonth)}-01`);
      expect(harness.current.periodEndDate).toBe(`${periodYear}-${pad(periodMonth)}-${pad(totalDays)}`);
    });

    it('prefills from a mid-month altaDate, clipped to the selected month (Scenario 4)', async () => {
      const employeeMidMonthAlta: Employee = { ...FAKE_EMPLOYEE, altaDate: '2026-06-10' };
      const harness = await renderUsePayrollRunForm([employeeMidMonthAlta], new InMemoryPayrollRunRepository());

      while (harness.current.periodMonth !== 6 || harness.current.periodYear !== 2026) {
        const goingUp = harness.current.periodYear < 2026 || (harness.current.periodYear === 2026 && harness.current.periodMonth < 6);
        await act(async () => {
          if (goingUp) {
            harness.current.incrementMonth();
          } else {
            harness.current.decrementMonth();
          }
        });
      }

      expect(harness.current.periodStartDate).toBe('2026-06-10');
      expect(harness.current.periodEndDate).toBe('2026-06-30');
    });

    it('prefills up to a mid-month bajaDate, clipped to the selected month (Scenario 5)', async () => {
      const employeeMidMonthBaja: Employee = { ...FAKE_EMPLOYEE, bajaDate: '2026-06-20' };
      const harness = await renderUsePayrollRunForm([employeeMidMonthBaja], new InMemoryPayrollRunRepository());

      while (harness.current.periodMonth !== 6 || harness.current.periodYear !== 2026) {
        const goingUp = harness.current.periodYear < 2026 || (harness.current.periodYear === 2026 && harness.current.periodMonth < 6);
        await act(async () => {
          if (goingUp) {
            harness.current.incrementMonth();
          } else {
            harness.current.decrementMonth();
          }
        });
      }

      expect(harness.current.periodStartDate).toBe('2026-06-01');
      expect(harness.current.periodEndDate).toBe('2026-06-20');
    });
  });

  describe('range validation (spec Scenario 9)', () => {
    it('rejects start > end: preview becomes null, rangeError is set, and submit is blocked without ever computing a run', async () => {
      const payrollRunRepository = new InMemoryPayrollRunRepository();
      const createSpy = jest.spyOn(payrollRunRepository, 'create');
      const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], payrollRunRepository);

      await act(async () => {
        harness.current.setPeriodStartDate('2026-06-20');
        harness.current.setPeriodEndDate('2026-06-10');
      });

      expect(harness.current.rangeError).toBe('La fecha de inicio no puede ser posterior a la fecha de fin.');
      expect(harness.current.preview).toBeNull();

      let success = true;
      await act(async () => {
        success = await harness.current.submit();
      });

      expect(success).toBe(false);
      expect(createSpy).not.toHaveBeenCalled();
      expect(harness.current.error).toBe('La fecha de inicio no puede ser posterior a la fecha de fin.');
    });
  });

  it('year_not_loaded: preview stays null and a Spanish warning is set; submit refuses to persist (design ADR-2)', async () => {
    const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], new InMemoryPayrollRunRepository());

    // Force the run period into 2027, a year with no loaded RatesConfig.
    while (harness.current.periodYear !== 2027) {
      await act(async () => {
        harness.current.incrementMonth();
      });
    }

    expect(harness.current.preview).toBeNull();
    expect(harness.current.ratesWarning).toBe(
      'No se han cargado las tarifas de cotización para este año. No se puede calcular la nómina.',
    );

    let success = true;
    await act(async () => {
      success = await harness.current.submit();
    });

    expect(success).toBe(false);
    expect(harness.current.error).toBe(
      'No se han cargado las tarifas de cotización para este año. No se puede calcular la nómina.',
    );
  });
});
