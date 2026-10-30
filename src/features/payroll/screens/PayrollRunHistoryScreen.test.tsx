/**
 * Render test for `PayrollRunHistoryScreen` (spec "receipt-dispatch" history
 * banner actions): the container pairs the last generated receipt's run with
 * its own uri, opens the in-app viewer through the router and keeps "Compartir"
 * on the share sheet. `expo-router` is mocked because `useRouter`/
 * `useFocusEffect` require a live navigation tree.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  CurrentEmployerProvider,
  MailServiceProvider,
  PdfServiceProvider,
  RepositoryProvider,
  type Repositories,
} from '@/core';
import { InMemorySettingsRepository } from '@/core/testing/fakes';
import {
  InMemoryEmployeeRepository,
  InMemoryEmployerRepository,
} from '@/features/employees/testing/fakes';
import { FAKE_EMPLOYER, makeEmployee } from '@/features/employees/testing/fixtures';
import { FakeMailSender, FakePdfSharer } from '@/services/mail/testing/fakes';
import { FakeReceiptPdfGenerator } from '@/services/pdf/testing/fakes';
import type { Employee, PayrollRun, ReceiptPdfGenerateOptions, ReceiptPdfGenerator } from '@/types';
import { cents } from '@/types/money';

import { InMemoryPayrollRunRepository } from '../testing/fakes';
import { PayrollRunHistoryScreen } from './PayrollRunHistoryScreen';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockRouterPush }),
  // The history hook already loads on mount; the focus refresh is irrelevant here.
  useFocusEffect: () => {},
}));

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_EMPLOYEE: Employee = makeEmployee();

function runFixture(id: string, periodMonth: number): PayrollRun {
  return {
    id,
    employeeId: FAKE_EMPLOYEE.id,
    periodYear: 2026,
    periodMonth,
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
}

// Only  is faked: the issue date is read at the hook's call boundary.
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

const RUN_A = runFixture('payroll-run-fake-a', 5);
const RUN_B = runFixture('payroll-run-fake-b', 6);

/** Succeeds like the shared fake until `failNext` is set, then rejects once. */
class FlakyReceiptPdfGenerator implements ReceiptPdfGenerator {
  failNext = false;
  /** When set, the next `generate` waits for it before running (to observe the in-flight state). */
  gate: Promise<void> | null = null;
  readonly inner = new FakeReceiptPdfGenerator();

  async generate(html: string, options?: ReceiptPdfGenerateOptions): Promise<{ readonly uri: string }> {
    if (this.gate !== null) {
      const gate = this.gate;
      this.gate = null;
      await gate;
    }
    if (this.failNext) {
      this.failNext = false;
      throw new Error('fake generation failure');
    }
    return this.inner.generate(html, options);
  }

  async discard(uri: string): Promise<void> {
    return this.inner.discard(uri);
  }
}

interface Harness {
  readonly renderer: ReactTestRenderer;
  readonly generator: FlakyReceiptPdfGenerator;
  readonly pdfSharer: FakePdfSharer;
  readonly mailSender: FakeMailSender;
}

// Unmounting after each test clears the FlatList's batched-render timer, which
// otherwise fires after the test finished and logs an act() warning.
let mounted: ReactTestRenderer | null = null;

async function renderScreen(employee: Employee = FAKE_EMPLOYEE): Promise<Harness> {
  const generator = new FlakyReceiptPdfGenerator();
  const pdfSharer = new FakePdfSharer();
  const mailSender = new FakeMailSender();
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([FAKE_EMPLOYER]),
    employees: new InMemoryEmployeeRepository([employee]),
    payrollRuns: new InMemoryPayrollRunRepository([RUN_A, RUN_B]),
    settings: new InMemorySettingsRepository(),
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <PdfServiceProvider generator={generator}>
            <MailServiceProvider pdfSharer={pdfSharer} mailSender={mailSender}>
              <PayrollRunHistoryScreen employeeId={FAKE_EMPLOYEE.id} />
            </MailServiceProvider>
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
  mounted = renderer;
  return { renderer, generator, pdfSharer, mailSender };
}

async function generate(renderer: ReactTestRenderer, run: PayrollRun): Promise<void> {
  await act(async () => {
    renderer.root.findByProps({ testID: `payroll-run-history-generate-${run.id}` }).props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function press(renderer: ReactTestRenderer, testID: string) {
  return act(async () => {
    renderer.root.findByProps({ testID }).props.onPress();
  });
}

describe('PayrollRunHistoryScreen', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
  });

  afterEach(async () => {
    const renderer = mounted;
    mounted = null;
    if (renderer !== null) {
      await act(async () => {
        renderer.unmount();
      });
    }
  });

  it('opens the in-app viewer with the matching run id and uri, without sharing', async () => {
    const { renderer, pdfSharer } = await renderScreen();

    await generate(renderer, RUN_B);
    await press(renderer, 'payroll-run-history-open');

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/payroll/receipt/[employeeId]',
      params: {
        employeeId: FAKE_EMPLOYEE.id,
        runId: RUN_B.id,
        uri: 'file:///fake/cache/Print/recibo-1.pdf',
      },
    });
    expect(pdfSharer.shareCallCount).toBe(0);
  });

  it('pushes the viewer only once when "Abrir recibo" is pressed twice in a row', async () => {
    const { renderer } = await renderScreen();

    await generate(renderer, RUN_B);
    await act(async () => {
      const open = renderer.root.findByProps({ testID: 'payroll-run-history-open' });
      open.props.onPress();
      open.props.onPress();
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it('shares the generated uri through the share sheet from "Compartir"', async () => {
    const { renderer, pdfSharer } = await renderScreen();

    await generate(renderer, RUN_B);
    await press(renderer, 'payroll-run-history-share');

    expect(pdfSharer.lastSharedUri).toBe('file:///fake/cache/Print/recibo-1.pdf');
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('keeps the previous run and uri pair when a second generation fails', async () => {
    const { renderer, generator } = await renderScreen();

    await generate(renderer, RUN_A);
    generator.failNext = true;
    await generate(renderer, RUN_B);
    await press(renderer, 'payroll-run-history-open');

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/payroll/receipt/[employeeId]',
      params: {
        employeeId: FAKE_EMPLOYEE.id,
        runId: RUN_A.id,
        uri: 'file:///fake/cache/Print/recibo-1.pdf',
      },
    });
  });

  it('pairs the newest run with its own uri after a second successful generation', async () => {
    const { renderer } = await renderScreen();

    await generate(renderer, RUN_A);
    await generate(renderer, RUN_B);
    await press(renderer, 'payroll-run-history-open');

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/payroll/receipt/[employeeId]',
      params: {
        employeeId: FAKE_EMPLOYEE.id,
        runId: RUN_B.id,
        uri: 'file:///fake/cache/Print/recibo-2.pdf',
      },
    });
  });

  it('does not keep claiming "Recibo enviado." after generating a different run', async () => {
    const { renderer, mailSender } = await renderScreen();
    mailSender.result = 'sent';
    await generate(renderer, RUN_A);
    await press(renderer, 'payroll-run-history-send');
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-sent' })).toBeTruthy();

    await generate(renderer, RUN_B);

    expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-dispatch-sent' })).toHaveLength(0);
  });

  it('disables every "Generar recibo" row while one generates, but only that row reads "Generando…"', async () => {
    const { renderer, generator } = await renderScreen();
    let release!: () => void;
    generator.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const rowOf = (run: PayrollRun) =>
      renderer.root.findByProps({ testID: `payroll-run-history-generate-${run.id}` });
    const labelOf = (run: PayrollRun) => rowOf(run).findByType(Text).props.children;

    await act(async () => {
      rowOf(RUN_B).props.onPress();
    });

    expect(rowOf(RUN_A).props.disabled).toBe(true);
    expect(rowOf(RUN_B).props.disabled).toBe(true);
    expect(labelOf(RUN_A)).toBe('Generar recibo');
    expect(labelOf(RUN_B)).toBe('Generando…');

    await act(async () => {
      release();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rowOf(RUN_A).props.disabled).toBe(false);
    expect(rowOf(RUN_B).props.disabled).toBe(false);
    expect(labelOf(RUN_A)).toBe('Generar recibo');
    expect(labelOf(RUN_B)).toBe('Generar recibo');
  });

  it('opens a plain receipt without the encrypted flag', async () => {
    const { renderer } = await renderScreen();

    await generate(renderer, RUN_B);
    await press(renderer, 'payroll-run-history-open');

    const params = mockRouterPush.mock.calls[0][0].params as Record<string, string>;
    expect(Object.keys(params).sort()).toEqual(['employeeId', 'runId', 'uri']);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-success' }).props.children).toBe(
      'Recibo generado.',
    );
  });

  describe('when the employee preference is ON', () => {
    it('generates a protected receipt with the NIF/NIE and says so in the banner', async () => {
      const { renderer, generator } = await renderScreen(PROTECTED_EMPLOYEE);

      await generate(renderer, RUN_B);

      expect(generator.inner.lastPassword).toBe('00000000T');
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-success' }).props.children).toBe(
        'Recibo generado y protegido con contraseña.',
      );
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-protected-hint' }).props.children).toBe(
        'Recuerda indicar al empleado cómo abrir el recibo protegido.',
      );
    });

    it('opens the viewer with the non-secret encrypted flag and no password', async () => {
      const { renderer } = await renderScreen(PROTECTED_EMPLOYEE);

      await generate(renderer, RUN_B);
      await press(renderer, 'payroll-run-history-open');

      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/payroll/receipt/[employeeId]',
        params: {
          employeeId: FAKE_EMPLOYEE.id,
          runId: RUN_B.id,
          uri: 'file:///fake/cache/Print/recibo-1.pdf',
          encrypted: '1',
        },
      });
      expect(JSON.stringify(mockRouterPush.mock.calls)).not.toContain('00000000T');
    });

    it('sends the protected mail wording and attaches the encrypted file', async () => {
      const { renderer, mailSender } = await renderScreen(PROTECTED_EMPLOYEE);

      await generate(renderer, RUN_B);
      await press(renderer, 'payroll-run-history-send');

      expect(mailSender.lastOptions?.attachmentUris).toEqual(['file:///fake/cache/Print/recibo-1.pdf']);
      expect(mailSender.lastOptions?.body).toContain('protegido con contraseña');
      expect(mailSender.lastOptions?.body).toContain('La contraseña es su NIF/NIE');
    });

    it('fails closed: shows the Spanish message and no receipt actions when no password is available', async () => {
      const { renderer, generator } = await renderScreen(makeEmployee({ nif: null, receiptEncryptionEnabled: true }));

      await generate(renderer, RUN_B);

      expect(renderer.root.findByProps({ testID: 'payroll-run-history-generate-error' }).props.children).toBe(
        'No se puede cifrar: este empleado no tiene NIF/NIE ni contraseña propia. Añádelo en su ficha.',
      );
      expect(generator.inner.lastHtml).toBeNull();
      expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-open' })).toHaveLength(0);
    });
  });

  describe('"Cifrar"', () => {
    const PLAIN_EMPLOYEE: Employee = makeEmployee({ nif: '00000000T' });
    const UNAVAILABLE_COPY =
      'No se puede cifrar: este empleado no tiene NIF/NIE ni contraseña propia. Añádelo en su ficha.';

    function setToday(isoDate: string) {
      jest.useFakeTimers({ now: new Date(`${isoDate}T10:00:00Z`), doNotFake: [...ONLY_DATE_FAKED] });
    }

    afterEach(() => {
      jest.useRealTimers();
    });

    it('regenerates with the original issue date and a password, replaces the file and discards the plain one', async () => {
      setToday('2026-03-01');
      const { renderer, generator } = await renderScreen(PLAIN_EMPLOYEE);
      await generate(renderer, RUN_B);
      expect(generator.inner.lastPassword).toBeNull();
      expect(generator.inner.lastHtml).toContain('1 de marzo de 2026');

      setToday('2026-03-05');
      await press(renderer, 'payroll-run-history-encrypt');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(generator.inner.lastPassword).toBe('00000000T');
      expect(generator.inner.lastHtml).toContain('1 de marzo de 2026');
      expect(generator.inner.lastHtml).not.toContain('5 de marzo de 2026');
      expect(generator.inner.discarded).toEqual(['file:///fake/cache/Print/recibo-1.pdf']);
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-success' }).props.children).toBe(
        'Recibo generado y protegido con contraseña.',
      );
      expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-encrypt' })).toHaveLength(0);
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-protected-hint' })).toBeTruthy();

      await press(renderer, 'payroll-run-history-open');
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/payroll/receipt/[employeeId]',
        params: {
          employeeId: FAKE_EMPLOYEE.id,
          runId: RUN_B.id,
          uri: 'file:///fake/cache/Print/recibo-2.pdf',
          encrypted: '1',
        },
      });
    });

    it('attaches the replacement file and uses the protected mail wording afterwards', async () => {
      const { renderer, mailSender, pdfSharer } = await renderScreen(PLAIN_EMPLOYEE);
      await generate(renderer, RUN_B);
      await press(renderer, 'payroll-run-history-encrypt');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      await press(renderer, 'payroll-run-history-share');
      await press(renderer, 'payroll-run-history-send');

      expect(pdfSharer.lastSharedUri).toBe('file:///fake/cache/Print/recibo-2.pdf');
      expect(mailSender.lastOptions?.attachmentUris).toEqual(['file:///fake/cache/Print/recibo-2.pdf']);
      expect(mailSender.lastOptions?.body).toContain('La contraseña es su NIF/NIE');
    });

    it('does not keep claiming "Recibo enviado." once the plain file is replaced by the protected one', async () => {
      const { renderer, mailSender } = await renderScreen(PLAIN_EMPLOYEE);
      mailSender.result = 'sent';
      await generate(renderer, RUN_B);
      await press(renderer, 'payroll-run-history-send');
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-sent' })).toBeTruthy();

      await press(renderer, 'payroll-run-history-encrypt');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-dispatch-sent' })).toHaveLength(0);
    });

    it('keeps the plain file, shows the error and stays plain when the encryption fails', async () => {
      const { renderer, generator } = await renderScreen(PLAIN_EMPLOYEE);
      await generate(renderer, RUN_B);

      generator.failNext = true;
      await press(renderer, 'payroll-run-history-encrypt');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(generator.inner.discarded).toEqual([]);
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-generate-error' }).props.children).toBe(
        'No se pudo generar el recibo protegido. Inténtalo de nuevo.',
      );
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-success' }).props.children).toBe(
        'Recibo generado.',
      );
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-encrypt' })).toBeTruthy();

      await press(renderer, 'payroll-run-history-open');
      const params = mockRouterPush.mock.calls[0][0].params as Record<string, string>;
      expect(params.uri).toBe('file:///fake/cache/Print/recibo-1.pdf');
      expect(params).not.toHaveProperty('encrypted');
    });

    it('keeps the plain file and says why when the employee has no password available', async () => {
      const { renderer, generator } = await renderScreen();
      await generate(renderer, RUN_B);

      await press(renderer, 'payroll-run-history-encrypt');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(renderer.root.findByProps({ testID: 'payroll-run-history-generate-error' }).props.children).toBe(
        UNAVAILABLE_COPY,
      );
      expect(generator.inner.discarded).toEqual([]);
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-success' }).props.children).toBe(
        'Recibo generado.',
      );
    });

    it('is not offered when the preference already produced an encrypted file', async () => {
      const { renderer } = await renderScreen(PROTECTED_EMPLOYEE);

      await generate(renderer, RUN_B);

      expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-encrypt' })).toHaveLength(0);
    });

    it('is not offered before any receipt was generated', async () => {
      const { renderer } = await renderScreen(PLAIN_EMPLOYEE);

      expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-encrypt' })).toHaveLength(0);
    });
  });

  it('shows no receipt actions when the only generation failed', async () => {
    const { renderer, generator } = await renderScreen();

    generator.failNext = true;
    await generate(renderer, RUN_A);

    expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-open' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-share' })).toHaveLength(0);
  });
});
