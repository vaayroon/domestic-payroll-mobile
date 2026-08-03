/**
 * Render test for `usePayrollRunForm` (spec "Payroll Run Screen" + tasks
 * 10.1): live preview recomputes on input change, the duplicate-period guard
 * blocks `create()` with a clear Spanish message, the happy path persists
 * the engine's exact computed fields, and a zero-run-days run with a
 * non-zero semester extra still previews correctly (spec "Zero-Days-Worked
 * Safety" / decision #674). Exercised against
 * `InMemoryEmployeeRepository`/`InMemoryEmployerRepository` (employees
 * feature) and `InMemoryPayrollRunRepository` (this feature) through the
 * same provider-injection pattern as `useEmployeeForm.test.tsx`.
 */

import { act, create } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import { CurrentEmployerProvider } from '@/features/employees/domain';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import type { Employee, Employer, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { usePayrollRunForm, type UsePayrollRunFormResult } from './usePayrollRunForm';
import { InMemoryPayrollRunRepository } from '../testing/fakes';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_EMPLOYER: Employer = { id: 'employer-fake-seed', name: 'Empleador', nif: null, address: null, createdAt: 0 };

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
  it('auto-selects the first employee and recomputes the preview as inputs change', async () => {
    const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], new InMemoryPayrollRunRepository());

    expect(harness.current.selectedEmployeeId).toBe(FAKE_EMPLOYEE.id);
    expect(harness.current.preview).toBeNull(); // no SS input yet

    await act(async () => {
      harness.current.setSsInput('100');
    });

    expect(harness.current.preview).not.toBeNull();
    expect(harness.current.preview?.grossCents).toBe(cents(90000));
    expect(harness.current.preview?.ssDeductionCents).toBe(cents(10000));
    expect(harness.current.preview?.netCents).toBe(cents(80000));
    expect(harness.current.preview?.prorated).toBe(false);

    await act(async () => {
      harness.current.setSsInput('150');
    });

    expect(harness.current.preview?.ssDeductionCents).toBe(cents(15000));
    expect(harness.current.preview?.netCents).toBe(cents(75000));
  });

  it('persists the engine-computed fields exactly on submit when no duplicate exists', async () => {
    const payrollRunRepository = new InMemoryPayrollRunRepository();
    const createSpy = jest.spyOn(payrollRunRepository, 'create');
    const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], payrollRunRepository);

    await act(async () => {
      harness.current.setSsInput('100');
    });

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
      ssDeductionCents: cents(10000),
      netCents: cents(80000),
      prorated: false,
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
        createdAt: 0,
      },
    ]);
    const createSpy = jest.spyOn(payrollRunRepository, 'create');
    const harness = await renderUsePayrollRunForm([FAKE_EMPLOYEE], payrollRunRepository);

    await act(async () => {
      harness.current.setSsInput('100');
    });

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
      harness.current.setSsInput('100');
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
});
