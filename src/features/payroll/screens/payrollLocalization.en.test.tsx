/**
 * English render tests for the payroll slice (i18n-ui-chrome, commit 5).
 * The Spanish assertions live in the per-view tests and stay unchanged.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { i18n } from '@/core/i18n';
import { FakePdfViewer } from '@/services/pdfviewer/testing/fakes';
import type { PayrollRun } from '@/types';
import { cents } from '@/types/money';

import {
  PayrollRunHistoryView,
  type PayrollRunHistoryViewProps,
} from './components/PayrollRunHistoryView';
import { ReceiptViewerView, type ReceiptViewerViewProps } from './components/ReceiptViewerView';

// `Intl.NumberFormat('es-ES', ...)` inserts a NON-BREAKING SPACE before `€`.
const NBSP = '\u00a0';

const FAKE_RUN: PayrollRun = {
  id: 'payroll-run-fake-1',
  employeeId: 'employee-fake-1',
  periodYear: 2026,
  periodMonth: 6,
  grossCents: cents(90000),
  ssDeductionCents: cents(10000),
  netCents: cents(1234567),
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

const historyProps: PayrollRunHistoryViewProps = {
  runs: [FAKE_RUN],
  loading: false,
  error: null,
  generating: false,
  generatingRunId: null,
  generateError: null,
  lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
  lastEncrypted: false,
  onGenerate: () => {},
  onOpen: () => {},
  onShare: () => {},
  onSendMail: () => {},
  onEncrypt: () => {},
  sharingAvailable: true,
  mailAvailable: true,
  dispatchStatus: 'idle',
  dispatchError: null,
};

const viewerProps: ReceiptViewerViewProps = {
  PdfViewer: FakePdfViewer,
  uri: 'file:///fake/cache/Print/recibo-1.pdf',
  awaitingPassword: false,
  protectedReceipt: false,
  pdfState: 'loading',
  onPdfLoad: () => {},
  onPdfFailure: () => {},
  onShare: () => {},
  onSendMail: () => {},
  shareEnabled: true,
  mailEnabled: true,
  mailHint: null,
  dispatchStatus: 'idle',
  dispatchError: null,
};

const mounted: ReactTestRenderer[] = [];

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(element);
  });
  mounted.push(renderer);
  return renderer;
}

function texts(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text).map((node) =>
    [node.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string')
      .join(''),
  );
}

function child(renderer: ReactTestRenderer, testID: string): unknown {
  return renderer.root.findByProps({ testID }).props.children;
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

// A mounted tree would still be subscribed when the language resets to `es`.
afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
});

describe('payroll receipt localization (en)', () => {
  it('renders the history chrome, the month and the banner in English', async () => {
    const renderer = await render(
      <PayrollRunHistoryView
        {...historyProps}
        mailAvailable={false}
        dispatchStatus="failed"
        dispatchError="send_failed"
      />,
    );
    const all = texts(renderer);

    expect(all).toEqual(
      expect.arrayContaining([
        'Payroll history',
        'June 2026',
        `12.345,67${NBSP}€`,
        'Generate payslip',
        'Payslip generated.',
        'Open payslip',
        'Share',
        'Send by email',
        'Encrypt',
        'No email app is set up on this device.',
        'The payslip could not be sent.',
      ]),
    );
  });

  it('maps the history read error code to English and keeps the detail as a secondary line', async () => {
    const renderer = await render(
      <PayrollRunHistoryView
        {...historyProps}
        error={{ code: 'read_failed', detail: 'disk I/O error' }}
      />,
    );

    expect(child(renderer, 'payroll-run-history-error-message')).toBe(
      'Could not load the payroll history.',
    );
    expect(child(renderer, 'payroll-run-history-error')).toBe('disk I/O error');
  });

  it('renders the protected banner and generation error codes in English', async () => {
    const renderer = await render(
      <PayrollRunHistoryView
        {...historyProps}
        lastEncrypted
        generateError={{ code: 'encryption_unavailable' }}
      />,
    );

    expect(child(renderer, 'payroll-run-history-success')).toBe(
      'Payslip generated and protected with a password.',
    );
    expect(child(renderer, 'payroll-run-history-protected-hint')).toBe(
      'Remember to tell the employee how to open the protected payslip.',
    );
    expect(child(renderer, 'payroll-run-history-generate-error')).toBe(
      'Cannot encrypt: this employee has no NIF/NIE and no own password. Add one in their profile.',
    );
  });

  it('renders the viewer chrome and accessibility labels in English', async () => {
    const renderer = await render(<ReceiptViewerView {...viewerProps} mailHint="run_missing" />);

    expect(
      renderer.root.findAll((n) => n.props.accessibilityLabel === 'Payslip PDF').length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAll((n) => n.props.accessibilityLabel === 'Loading payslip').length,
    ).toBeGreaterThan(0);
    expect(child(renderer, 'receipt-viewer-loading')).toBe('Loading payslip…');
    expect(child(renderer, 'receipt-viewer-mail-hint')).toBe(
      'The payroll for this payslip was not found.',
    );
  });

  it('renders the viewer failure copy in English, plain and protected', async () => {
    const plain = await render(<ReceiptViewerView {...viewerProps} uri={null} />);
    expect(child(plain, 'receipt-viewer-failed')).toBe(
      'The payslip could not be displayed. Generate it again from the payroll history.',
    );

    const protectedView = await render(
      <ReceiptViewerView {...viewerProps} pdfState="failed" protectedReceipt />,
    );
    expect(child(protectedView, 'receipt-viewer-failed')).toBe(
      'The protected payslip could not be opened. Generate it again from the payroll history.',
    );
  });
});
