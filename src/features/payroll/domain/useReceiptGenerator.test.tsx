/**
 * Render test for `useReceiptGenerator` (spec "payroll-run-history"
 * "Successful generation surfaces file URI" / design ADR-5, ADR-6): exercises
 * the full `buildReceiptViewModel` -> `buildReceiptHtml` -> generate seam
 * against `FakeReceiptPdfGenerator` (real `expo-print` can't run under
 * `jest-expo` headless), asserting a `uri` is returned and the HTML handed to
 * the fake carries the expected Spanish markers, entirely offline (no native
 * module invoked).
 */

import { act, create } from 'react-test-renderer';

import {
  CurrentEmployerProvider,
  EMPLOYER_SIGNATURE_KEY,
  PdfServiceProvider,
  RepositoryProvider,
  serializeEmployerSignature,
  type Repositories,
} from '@/core';
import { InMemorySettingsRepository } from '@/core/testing/fakes';
import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from '@/core/testing/fixtures';
import { FakeReceiptPdfGenerator } from '@/services/pdf/testing/fakes';
import type { Employee, PayrollRun, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { useReceiptGenerator, type UseReceiptGeneratorResult } from './useReceiptGenerator';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import { FAKE_EMPLOYER } from '@/features/employees/testing/fixtures';
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
  grupoCotizacion: null,
};

const FAKE_RUN: PayrollRun = {
  id: 'payroll-run-fake-1',
  employeeId: FAKE_EMPLOYEE.id,
  periodYear: 2026,
  periodMonth: 6,
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
  employerTotalEfectivoCents: null,
  createdAt: 0,
};

function HookHarness({ onResult }: { onResult: (result: UseReceiptGeneratorResult) => void }) {
  const result = useReceiptGenerator();
  onResult(result);
  return null;
}

async function renderUseReceiptGenerator(
  generator: FakeReceiptPdfGenerator,
  settings: SettingsRepository = new InMemorySettingsRepository(),
) {
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([FAKE_EMPLOYER]),
    employees: new InMemoryEmployeeRepository([FAKE_EMPLOYEE]),
    payrollRuns: new InMemoryPayrollRunRepository([FAKE_RUN]),
    settings,
  };

  let latest!: UseReceiptGeneratorResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <PdfServiceProvider generator={generator}>
            <HookHarness onResult={(result) => (latest = result)} />
          </PdfServiceProvider>
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get current(): UseReceiptGeneratorResult {
      return latest;
    },
  };
}

describe('useReceiptGenerator', () => {
  it('generates a receipt PDF and surfaces the resulting file uri', async () => {
    const generator = new FakeReceiptPdfGenerator();
    const harness = await renderUseReceiptGenerator(generator);

    let result: { readonly uri: string } | null = null;
    await act(async () => {
      result = await harness.current.generate(FAKE_RUN);
    });

    expect(result).toEqual({ uri: 'file:///fake/cache/Print/recibo-1.pdf' });
    expect(harness.current.generating).toBe(false);
    expect(harness.current.error).toBeNull();

    // The HTML passed to the sealed PDF engine carries the expected Spanish markers.
    expect(generator.lastHtml).not.toBeNull();
    expect(generator.lastHtml).toContain('Recibo Individual de Salarios');
    expect(generator.lastHtml).toContain(FAKE_EMPLOYEE.name);
    expect(generator.lastHtml).toContain(FAKE_EMPLOYER.name);
  });

  it('surfaces a Spanish error when the employee cannot be found', async () => {
    const generator = new FakeReceiptPdfGenerator();
    const harness = await renderUseReceiptGenerator(generator);

    const missingEmployeeRun: PayrollRun = { ...FAKE_RUN, employeeId: 'employee-fake-missing' };

    let result: { readonly uri: string } | null = null;
    await act(async () => {
      result = await harness.current.generate(missingEmployeeRun);
    });

    expect(result).toBeNull();
    expect(harness.current.error).toMatch(/No se encontró/);
    expect(generator.lastHtml).toBeNull();
  });

  it('embeds a saved employer signature into the generated HTML', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set(
      EMPLOYER_SIGNATURE_KEY,
      serializeEmployerSignature({ pngBase64: SYNTHETIC_SIGNATURE_PNG_BASE64, updatedAt: 1 }),
    );
    const generator = new FakeReceiptPdfGenerator();
    const harness = await renderUseReceiptGenerator(generator, settings);

    await act(async () => {
      await harness.current.generate(FAKE_RUN);
    });

    expect(generator.lastHtml).toContain(`data:image/png;base64,${SYNTHETIC_SIGNATURE_PNG_BASE64}`);
    expect(harness.current.error).toBeNull();
  });

  it('degrades to a no-image receipt, without blocking generation, when the settings read fails', async () => {
    const throwingSettings: SettingsRepository = {
      get: () => Promise.reject(new Error('I/O error')),
      set: () => Promise.reject(new Error('unused')),
    };
    const generator = new FakeReceiptPdfGenerator();
    const harness = await renderUseReceiptGenerator(generator, throwingSettings);

    let result: { readonly uri: string } | null = null;
    await act(async () => {
      result = await harness.current.generate(FAKE_RUN);
    });

    expect(result).toEqual({ uri: 'file:///fake/cache/Print/recibo-1.pdf' });
    expect(harness.current.error).toBeNull();
    expect(generator.lastHtml).not.toBeNull();
    expect(generator.lastHtml).not.toContain('<img');
  });
});
