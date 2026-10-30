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
  RECEIPT_FILE_NAME_FORMAT_KEY,
  RepositoryProvider,
  serializeEmployerSignature,
  type Repositories,
} from '@/core';
import { InMemorySettingsRepository } from '@/core/testing/fakes';
import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from '@/core/testing/fixtures';
import { FakeReceiptPdfGenerator } from '@/services/pdf/testing/fakes';
import type { Employee, PayrollRun, ReceiptPdfGenerator, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import {
  useReceiptGenerator,
  type GeneratedReceipt,
  type UseReceiptGeneratorResult,
} from './useReceiptGenerator';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import { FAKE_EMPLOYER, makeEmployee } from '@/features/employees/testing/fixtures';
import { InMemoryPayrollRunRepository } from '../testing/fakes';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).

const FAKE_EMPLOYEE: Employee = makeEmployee();

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

// "Today" is read at the hook's call boundary, so only `Date` is faked.
const TODAY_ISO = '2026-03-05';
const ONLY_DATE_FAKED = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

const PROTECTED_EMPLOYEE: Employee = makeEmployee({ nif: '00000000T', receiptEncryptionEnabled: true });
const UNAVAILABLE_COPY =
  'No se puede cifrar: este empleado no tiene NIF/NIE ni contraseña propia. Añádelo en su ficha.';
const ENCRYPT_FAILED_COPY = 'No se pudo generar el recibo protegido. Inténtalo de nuevo.';

function HookHarness({ onResult }: { onResult: (result: UseReceiptGeneratorResult) => void }) {
  const result = useReceiptGenerator();
  onResult(result);
  return null;
}

async function renderUseReceiptGenerator(
  generator: ReceiptPdfGenerator,
  settings: SettingsRepository = new InMemorySettingsRepository(),
  employee: Employee = FAKE_EMPLOYEE,
) {
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([FAKE_EMPLOYER]),
    employees: new InMemoryEmployeeRepository([employee]),
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
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(`${TODAY_ISO}T10:00:00Z`), doNotFake: [...ONLY_DATE_FAKED] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('generates a receipt PDF and surfaces the resulting file uri', async () => {
    const generator = new FakeReceiptPdfGenerator();
    const harness = await renderUseReceiptGenerator(generator);

    let result: GeneratedReceipt | null = null;
    await act(async () => {
      result = await harness.current.generate(FAKE_RUN);
    });

    expect(result).toEqual({
      uri: 'file:///fake/cache/Print/recibo-1.pdf',
      issuedOnIso: TODAY_ISO,
      encrypted: false,
    });
    expect(generator.lastPassword).toBeNull();
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

    let result: GeneratedReceipt | null = null;
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

    let result: GeneratedReceipt | null = null;
    await act(async () => {
      result = await harness.current.generate(FAKE_RUN);
    });

    expect(result).toEqual({
      uri: 'file:///fake/cache/Print/recibo-1.pdf',
      issuedOnIso: TODAY_ISO,
      encrypted: false,
    });
    expect(harness.current.error).toBeNull();
    expect(generator.lastHtml).not.toBeNull();
    expect(generator.lastHtml).not.toContain('<img');
  });
  describe('with the employee preference ON', () => {
    it('encrypts with the normalized NIF/NIE and reports the file as encrypted', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({ nif: ' 00000000-t ', receiptEncryptionEnabled: true });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastPassword).toBe('00000000T');
      expect(result).toEqual({
        uri: 'file:///fake/cache/Print/recibo-1.pdf',
        issuedOnIso: TODAY_ISO,
        encrypted: true,
      });
      expect(harness.current.error).toBeNull();
    });

    it('prefers the own password over the NIF/NIE', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({
        nif: '00000000T',
        receiptEncryptionEnabled: true,
        receiptPasswordOverride: 'clave 1',
      });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      await act(async () => {
        await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastPassword).toBe('clave 1');
    });

    it('fails closed without calling the generator when there is no NIF/NIE and no own password', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({ nif: null, receiptEncryptionEnabled: true });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN);
      });

      expect(result).toBeNull();
      expect(harness.current.error).toBe(UNAVAILABLE_COPY);
      expect(generator.lastHtml).toBeNull();
      expect(generator.lastPassword).toBeNull();
      expect(harness.current.generating).toBe(false);
    });

    it('fails closed when the stored own password no longer validates, instead of falling back to the NIF', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({
        nif: '00000000T',
        receiptEncryptionEnabled: true,
        receiptPasswordOverride: 'contraseña',
      });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      await act(async () => {
        await harness.current.generate(FAKE_RUN);
      });

      expect(harness.current.error).toBe(UNAVAILABLE_COPY);
      expect(generator.lastHtml).toBeNull();
    });

    it('maps any generator failure to fixed Spanish copy that never leaks the cause or the password', async () => {
      const generator = new FakeReceiptPdfGenerator();
      generator.nextError = new Error('pdf-lib exploded with 00000000T');
      const harness = await renderUseReceiptGenerator(generator, undefined, PROTECTED_EMPLOYEE);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN);
      });

      expect(result).toBeNull();
      expect(harness.current.error).toBe(ENCRYPT_FAILED_COPY);
      expect(harness.current.error).not.toContain('00000000T');
      expect(harness.current.generating).toBe(false);
    });
  });

  describe('with the employee preference OFF', () => {
    it('keeps the plain path when the employee has a NIF/NIE and an own password', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({ nif: '00000000T', receiptPasswordOverride: 'clave 1' });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastPassword).toBeNull();
      expect(result).toMatchObject({ encrypted: false });
    });

    it('surfaces the original generator error message on the plain path', async () => {
      const generator = new FakeReceiptPdfGenerator();
      generator.nextError = new Error('print failed');
      const harness = await renderUseReceiptGenerator(generator);

      await act(async () => {
        await harness.current.generate(FAKE_RUN);
      });

      expect(harness.current.error).toBe('print failed');
    });

    it('encrypts when the caller asks for it explicitly', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({ nif: 'X0000000T' });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN, { encrypt: true });
      });

      expect(generator.lastPassword).toBe('X0000000T');
      expect(result).toMatchObject({ encrypted: true });
    });
  });

  describe('issue date', () => {
    it('prints and returns the given issue date instead of today', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN, { issuedOnIso: '2026-03-01' });
      });

      expect(result).toMatchObject({ issuedOnIso: '2026-03-01' });
      expect(generator.lastHtml).toContain('1 de marzo de 2026');
      expect(generator.lastHtml).not.toContain('5 de marzo de 2026');
    });

    it('prints today when no issue date is given', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator);

      await act(async () => {
        await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastHtml).toContain('5 de marzo de 2026');
    });
  });

  describe('regenerateProtected', () => {
    const PLAIN_PREVIOUS = {
      run: FAKE_RUN,
      uri: 'file:///fake/cache/Print/plain-previous.pdf',
      issuedOnIso: '2026-03-01',
      encrypted: false,
    } as const;

    it('regenerates with a password and the original issue date, then discards the previous file', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({ nif: '00000000T' });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.regenerateProtected(PLAIN_PREVIOUS);
      });

      expect(result).toEqual({
        uri: 'file:///fake/cache/Print/recibo-1.pdf',
        issuedOnIso: '2026-03-01',
        encrypted: true,
      });
      expect(generator.lastPassword).toBe('00000000T');
      expect(generator.lastHtml).toContain('1 de marzo de 2026');
      expect(generator.discarded).toEqual([PLAIN_PREVIOUS.uri]);
      expect(harness.current.error).toBeNull();
    });

    it('keeps the previous file when the regeneration fails', async () => {
      const generator = new FakeReceiptPdfGenerator();
      generator.nextError = new Error('boom');
      const employee = makeEmployee({ nif: '00000000T' });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.regenerateProtected(PLAIN_PREVIOUS);
      });

      expect(result).toBeNull();
      expect(generator.discarded).toEqual([]);
      expect(harness.current.error).toBe(ENCRYPT_FAILED_COPY);
    });

    it('keeps the previous file and never calls the generator when no password is available', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.regenerateProtected(PLAIN_PREVIOUS);
      });

      expect(result).toBeNull();
      expect(generator.lastHtml).toBeNull();
      expect(generator.discarded).toEqual([]);
      expect(harness.current.error).toBe(UNAVAILABLE_COPY);
    });

    it('never discards the file it just produced', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({ nif: '00000000T' });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      await act(async () => {
        await harness.current.regenerateProtected({
          ...PLAIN_PREVIOUS,
          uri: 'file:///fake/cache/Print/recibo-1.pdf',
        });
      });

      expect(generator.discarded).toEqual([]);
    });

    it('still succeeds when discarding the previous file rejects', async () => {
      const inner = new FakeReceiptPdfGenerator();
      const generator: ReceiptPdfGenerator = {
        generate: (html, options) => inner.generate(html, options),
        discard: () => Promise.reject(new Error('disk')),
      };
      const employee = makeEmployee({ nif: '00000000T' });
      const harness = await renderUseReceiptGenerator(generator, undefined, employee);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.regenerateProtected(PLAIN_PREVIOUS);
      });

      expect(result).toMatchObject({ encrypted: true });
      expect(harness.current.error).toBeNull();
    });
  });

  describe('readable file name from the general format', () => {
    async function settingsWithFormat(value: string): Promise<InMemorySettingsRepository> {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, value);
      return settings;
    }

    it('passes no file name and keeps the random uri when no format is set', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastFileName).toBeNull();
      expect(result).toMatchObject({ uri: 'file:///fake/cache/Print/recibo-1.pdf' });
    });

    it('names the file from the employee name and the run period', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator, await settingsWithFormat('name-month-year'));

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastFileName).toBe('EmpleadaDePrueba-NominaJunio2026');
      expect(result).toMatchObject({
        uri: 'file:///fake/cache/receipts/fake-1/EmpleadaDePrueba-NominaJunio2026.pdf',
        encrypted: false,
      });
      expect(harness.current.error).toBeNull();
    });

    it('takes the month and year from the run, never from the issue date', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator, await settingsWithFormat('month-year'));

      await act(async () => {
        await harness.current.generate(FAKE_RUN, { issuedOnIso: '2026-11-03' });
      });

      expect(generator.lastFileName).toBe('Nomina-Junio2026');
      expect(generator.lastHtml).toContain('3 de noviembre de 2026');
    });

    it.each([
      ['name-year-month', 'EmpleadaDePrueba-Nomina-2026-06'],
      ['year-month-name', '2026-06-Nomina-EmpleadaDePrueba'],
    ])('applies the %s layout', async (format, expected) => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator, await settingsWithFormat(format));

      await act(async () => {
        await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastFileName).toBe(expected);
    });

    it('carries the name together with the password on the encrypted path', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({ nif: '00000000T', receiptEncryptionEnabled: true });
      const harness = await renderUseReceiptGenerator(generator, await settingsWithFormat('month-year'), employee);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastFileName).toBe('Nomina-Junio2026');
      expect(generator.lastPassword).toBe('00000000T');
      expect(result).toMatchObject({ uri: 'file:///fake/cache/receipts/fake-1/Nomina-Junio2026.pdf', encrypted: true });
    });

    it('regenerates a protected copy under the name and discards the previous plain file', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const employee = makeEmployee({ nif: '00000000T' });
      const harness = await renderUseReceiptGenerator(generator, await settingsWithFormat('month-year'), employee);
      const previous = {
        run: FAKE_RUN,
        uri: 'file:///fake/cache/receipts/fake-0/Nomina-Junio2026.pdf',
        issuedOnIso: '2026-03-01',
        encrypted: false,
      } as const;

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.regenerateProtected(previous);
      });

      expect(generator.lastFileName).toBe('Nomina-Junio2026');
      expect(generator.lastPassword).toBe('00000000T');
      expect(result).toMatchObject({ uri: 'file:///fake/cache/receipts/fake-1/Nomina-Junio2026.pdf', encrypted: true });
      expect(generator.discarded).toEqual([previous.uri]);
    });

    it('generates without a name when the period cannot be turned into one', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator, await settingsWithFormat('name-month-year'));

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate({ ...FAKE_RUN, periodMonth: 13 });
      });

      expect(generator.lastHtml).not.toBeNull();
      expect(generator.lastFileName).toBeNull();
      expect(result).toMatchObject({ uri: 'file:///fake/cache/Print/recibo-1.pdf' });
      expect(harness.current.error).toBeNull();
    });

    it('generates without a name when the stored format is corrupt', async () => {
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator, await settingsWithFormat('bogus'));

      await act(async () => {
        await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastFileName).toBeNull();
      expect(harness.current.error).toBeNull();
    });

    it('generates without a name when reading the settings fails', async () => {
      const throwingSettings: SettingsRepository = {
        get: () => Promise.reject(new Error('I/O error')),
        set: () => Promise.reject(new Error('unused')),
      };
      const generator = new FakeReceiptPdfGenerator();
      const harness = await renderUseReceiptGenerator(generator, throwingSettings);

      let result: GeneratedReceipt | null = null;
      await act(async () => {
        result = await harness.current.generate(FAKE_RUN);
      });

      expect(generator.lastHtml).not.toBeNull();
      expect(generator.lastFileName).toBeNull();
      expect(result).toMatchObject({ uri: 'file:///fake/cache/Print/recibo-1.pdf' });
      expect(harness.current.error).toBeNull();
    });
  });
});
