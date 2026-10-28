/**
 * Render test for `ReceiptViewerScreen` (spec "receipt-pdf-viewer"): the full
 * provider harness with `FakePdfViewer`, `FakePdfSharer`, `FakeMailSender` and
 * in-memory repositories. Imports the fake viewer directly, never the
 * `@/services/pdfviewer` barrel (it loads the native module).
 */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  MailServiceProvider,
  PdfViewerProvider,
  RepositoryProvider,
  type Repositories,
} from '@/core';
import {
  InMemoryEmployeeRepository,
  InMemoryEmployerRepository,
} from '@/features/employees/testing/fakes';
import { FakeMailSender, FakePdfSharer } from '@/services/mail/testing/fakes';
import {
  FakePdfViewer,
  getFakePdfViewerLastUri,
  getFakePdfViewerMountCount,
  setFakePdfViewerBehavior,
} from '@/services/pdfviewer/testing/fakes';
import type { Employee, PayrollRun, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { InMemoryPayrollRunRepository } from '../testing/fakes';
import { ReceiptViewerScreen, type ReceiptViewerScreenProps } from './ReceiptViewerScreen';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_EMPLOYEE: Employee = {
  id: 'employee-fake-1',
  employerId: 'employer-fake-seed',
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

const FAKE_URI = 'file:///fake/recibo-1.pdf';

const FAILURE_COPY =
  'No se pudo mostrar el recibo. Vuelve a generarlo desde el historial de nóminas.';

const VALID_PARAMS: ReceiptViewerScreenProps['params'] = {
  employeeId: FAKE_EMPLOYEE.id,
  runId: FAKE_RUN.id,
  uri: FAKE_URI,
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

interface Harness {
  readonly renderer: ReactTestRenderer;
  readonly pdfSharer: FakePdfSharer;
  readonly mailSender: FakeMailSender;
}

async function renderScreen(
  params: ReceiptViewerScreenProps['params'],
  { runs = [FAKE_RUN] }: { runs?: PayrollRun[] } = {},
): Promise<Harness> {
  const pdfSharer = new FakePdfSharer();
  const mailSender = new FakeMailSender();
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([]),
    employees: new InMemoryEmployeeRepository([FAKE_EMPLOYEE]),
    payrollRuns: new InMemoryPayrollRunRepository(runs),
    settings: fakeSettingsRepository,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <MailServiceProvider pdfSharer={pdfSharer} mailSender={mailSender}>
          <PdfViewerProvider viewer={FakePdfViewer}>
            <ReceiptViewerScreen params={params} />
          </PdfViewerProvider>
        </MailServiceProvider>
      </RepositoryProvider>,
    );
  });
  // Let the availability checks and the run lookup settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return { renderer, pdfSharer, mailSender };
}

function find(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

function has(renderer: ReactTestRenderer, testID: string): boolean {
  return renderer.root.findAllByProps({ testID }).length > 0;
}

describe('ReceiptViewerScreen', () => {
  beforeEach(() => {
    setFakePdfViewerBehavior({ kind: 'loaded', pageCount: 1 });
  });

  it('mounts the viewer once with the uri, hides the loading text and enables the actions', async () => {
    const { renderer } = await renderScreen(VALID_PARAMS);

    expect(getFakePdfViewerLastUri()).toBe(FAKE_URI);
    expect(getFakePdfViewerMountCount()).toBe(1);
    expect(has(renderer, 'receipt-viewer-loading')).toBe(false);
    expect(has(renderer, 'receipt-viewer-failed')).toBe(false);
    expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(false);
    expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(false);
  });

  it('shows the loading text while the viewer has not reported yet', async () => {
    setFakePdfViewerBehavior({ kind: 'pending' });
    const { renderer } = await renderScreen(VALID_PARAMS);

    expect(find(renderer, 'receipt-viewer-loading').props.children).toBe('Cargando recibo…');
    expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(true);
    expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(true);
  });

  it('shows the failure copy and no action bar when the viewer reports load_failed', async () => {
    setFakePdfViewerBehavior({ kind: 'error' });
    const { renderer } = await renderScreen(VALID_PARAMS);

    expect(find(renderer, 'receipt-viewer-failed').props.children).toBe(FAILURE_COPY);
    expect(has(renderer, 'receipt-viewer-loading')).toBe(false);
    expect(has(renderer, 'receipt-viewer-share')).toBe(false);
    expect(has(renderer, 'receipt-viewer-send')).toBe(false);
  });

  it.each([
    ['https scheme', { ...VALID_PARAMS, uri: 'https://example.invalid/a.pdf' }],
    ['content scheme', { ...VALID_PARAMS, uri: 'content://fake/a.pdf' }],
    ['non-pdf extension', { ...VALID_PARAMS, uri: 'file:///fake/a.png' }],
    ['empty uri', { ...VALID_PARAMS, uri: '' }],
    ['absent uri', { employeeId: FAKE_EMPLOYEE.id, runId: FAKE_RUN.id }],
    ['array uri', { ...VALID_PARAMS, uri: [FAKE_URI, FAKE_URI] }],
    ['missing run id', { employeeId: FAKE_EMPLOYEE.id, uri: FAKE_URI }],
  ])('rejects %s: failure state and the viewer is never mounted', async (_label, params) => {
    const { renderer } = await renderScreen(params);

    expect(find(renderer, 'receipt-viewer-failed').props.children).toBe(FAILURE_COPY);
    expect(has(renderer, 'receipt-viewer-share')).toBe(false);
    expect(getFakePdfViewerLastUri()).toBeNull();
    expect(getFakePdfViewerMountCount()).toBe(0);
  });

  it('shares the uri through PdfSharer when "Compartir" is pressed', async () => {
    const { renderer, pdfSharer } = await renderScreen(VALID_PARAMS);

    await act(async () => {
      find(renderer, 'receipt-viewer-share').props.onPress();
    });

    expect(pdfSharer.lastSharedUri).toBe(FAKE_URI);
    expect(pdfSharer.lastDialogTitle).toBe('Compartir recibo');
  });

  it('disables "Compartir" when sharing is unavailable', async () => {
    const spy = jest.spyOn(FakePdfSharer.prototype, 'isAvailable').mockResolvedValue(false);
    try {
      const { renderer } = await renderScreen(VALID_PARAMS);

      expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(true);
      expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('sends the receipt by mail with the uri attached when "Enviar por correo" is pressed', async () => {
    const { renderer, mailSender } = await renderScreen(VALID_PARAMS);

    await act(async () => {
      find(renderer, 'receipt-viewer-send').props.onPress();
    });

    expect(mailSender.lastOptions?.attachmentUris).toEqual([FAKE_URI]);
    expect(find(renderer, 'receipt-viewer-dispatch-sent').props.children).toBe('Recibo enviado.');
  });

  it('disables mail with a hint but still renders the PDF when the run is not found', async () => {
    const { renderer } = await renderScreen(VALID_PARAMS, { runs: [] });

    expect(getFakePdfViewerMountCount()).toBe(1);
    expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(true);
    expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(false);
    expect(find(renderer, 'receipt-viewer-mail-hint').props.children).toBe(
      'No se encontró la nómina de este recibo.',
    );
  });

  it('shows the mail-unavailable hint and disables mail when no mail app is configured', async () => {
    const spy = jest.spyOn(FakeMailSender.prototype, 'isAvailable').mockResolvedValue(false);
    try {
      const { renderer } = await renderScreen(VALID_PARAMS);

      expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(true);
      expect(find(renderer, 'receipt-viewer-mail-hint').props.children).toBe(
        'No hay ninguna app de correo configurada en este dispositivo.',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('shows the dispatch error when sharing fails', async () => {
    const spy = jest.spyOn(FakePdfSharer.prototype, 'share').mockRejectedValue(new Error('boom'));
    try {
      const { renderer } = await renderScreen(VALID_PARAMS);

      await act(async () => {
        find(renderer, 'receipt-viewer-share').props.onPress();
      });

      expect(find(renderer, 'receipt-viewer-dispatch-failed').props.children).toBe(
        'No se pudo compartir el recibo.',
      );
    } finally {
      spy.mockRestore();
    }
  });
});
