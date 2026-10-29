/**
 * Render test for `PayrollRunHistoryScreen` (spec "receipt-dispatch" history
 * banner actions): the container pairs the last generated receipt's run with
 * its own uri, opens the in-app viewer through the router and keeps "Compartir"
 * on the share sheet. `expo-router` is mocked because `useRouter`/
 * `useFocusEffect` require a live navigation tree.
 */

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
import type { Employee, PayrollRun, ReceiptPdfGenerator } from '@/types';
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

const RUN_A = runFixture('payroll-run-fake-a', 5);
const RUN_B = runFixture('payroll-run-fake-b', 6);

/** Succeeds like the shared fake until `failNext` is set, then rejects once. */
class FlakyReceiptPdfGenerator implements ReceiptPdfGenerator {
  failNext = false;
  private readonly inner = new FakeReceiptPdfGenerator();

  async generate(html: string): Promise<{ readonly uri: string }> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('fake generation failure');
    }
    return this.inner.generate(html);
  }
}

interface Harness {
  readonly renderer: ReactTestRenderer;
  readonly generator: FlakyReceiptPdfGenerator;
  readonly pdfSharer: FakePdfSharer;
}

// Unmounting after each test clears the FlatList's batched-render timer, which
// otherwise fires after the test finished and logs an act() warning.
let mounted: ReactTestRenderer | null = null;

async function renderScreen(): Promise<Harness> {
  const generator = new FlakyReceiptPdfGenerator();
  const pdfSharer = new FakePdfSharer();
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([FAKE_EMPLOYER]),
    employees: new InMemoryEmployeeRepository([FAKE_EMPLOYEE]),
    payrollRuns: new InMemoryPayrollRunRepository([RUN_A, RUN_B]),
    settings: new InMemorySettingsRepository(),
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <PdfServiceProvider generator={generator}>
            <MailServiceProvider pdfSharer={pdfSharer} mailSender={new FakeMailSender()}>
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
  return { renderer, generator, pdfSharer };
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

  it('shows no receipt actions when the only generation failed', async () => {
    const { renderer, generator } = await renderScreen();

    generator.failNext = true;
    await generate(renderer, RUN_A);

    expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-open' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-share' })).toHaveLength(0);
  });
});
