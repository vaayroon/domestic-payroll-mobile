/**
 * Render test for `useReceiptDispatch` (spec "receipt-dispatch" / design
 * ADR-8, ADR-11): exercises open/send success, cancelled, failure, and
 * mail/sharing-unavailable paths against `FakePdfSharer`/`FakeMailSender`
 * (real `expo-sharing`/`expo-mail-composer` can't run under `jest-expo`
 * headless), entirely offline (no native module invoked).
 */

import { act, create } from 'react-test-renderer';

import {
  CurrentEmployerProvider,
  MailServiceProvider,
  PdfServiceProvider,
  RepositoryProvider,
  type Repositories,
} from '@/core';
import { FakeReceiptPdfGenerator } from '@/services/pdf/testing/fakes';
import { FakeMailSender, FakePdfSharer } from '@/services/mail/testing/fakes';
import { makeEmployee } from '@/features/employees/testing/fixtures';
import type { Employee, PayrollRun, SettingsRepository } from '@/types';
import { cents } from '@/types/money';

import { useReceiptDispatch, type UseReceiptDispatchResult } from './useReceiptDispatch';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import { InMemoryPayrollRunRepository } from '../testing/fakes';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_EMPLOYEE: Employee = makeEmployee({
  employerId: 'employer-fake-seed',
});

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

const FAKE_URI = 'file:///fake/cache/Print/recibo-1.pdf';

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

const fakeSettingsRepository: SettingsRepository = {
  get: notImplemented('SettingsRepository.get'),
  set: notImplemented('SettingsRepository.set'),
};

function HookHarness({
  run,
  uri,
  encrypted,
  onResult,
}: {
  run: PayrollRun | null;
  uri: string | null;
  encrypted?: boolean;
  onResult: (result: UseReceiptDispatchResult) => void;
}) {
  const result = useReceiptDispatch(run, uri, encrypted);
  onResult(result);
  return null;
}

async function renderUseReceiptDispatch(
  pdfSharer: FakePdfSharer,
  mailSender: FakeMailSender,
  run: PayrollRun | null = FAKE_RUN,
  uri: string | null = FAKE_URI,
  { encrypted, employee = FAKE_EMPLOYEE }: { encrypted?: boolean; employee?: Employee } = {},
) {
  const repositories: Repositories = {
    employers: new InMemoryEmployerRepository([]),
    employees: new InMemoryEmployeeRepository([employee]),
    payrollRuns: new InMemoryPayrollRunRepository([FAKE_RUN]),
    settings: fakeSettingsRepository,
  };

  let latest!: UseReceiptDispatchResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <PdfServiceProvider generator={new FakeReceiptPdfGenerator()}>
            <MailServiceProvider pdfSharer={pdfSharer} mailSender={mailSender}>
              <HookHarness run={run} uri={uri} encrypted={encrypted} onResult={(result) => (latest = result)} />
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

  return {
    get current(): UseReceiptDispatchResult {
      return latest;
    },
  };
}

describe('useReceiptDispatch', () => {
  it('shares the generated pdf uri when shareReceipt succeeds', async () => {
    const pdfSharer = new FakePdfSharer();
    const mailSender = new FakeMailSender();
    const harness = await renderUseReceiptDispatch(pdfSharer, mailSender);

    await act(async () => {
      await harness.current.shareReceipt();
    });

    expect(pdfSharer.lastSharedUri).toBe(FAKE_URI);
    expect(pdfSharer.lastDialogTitle).toBe('Compartir recibo');
    expect(harness.current.status).toBe('idle');
    expect(harness.current.error).toBeNull();
  });

  it('surfaces a Spanish share-specific error when sharing fails', async () => {
    const pdfSharer = new FakePdfSharer();
    pdfSharer.share = async () => {
      throw new Error('native failure');
    };
    const mailSender = new FakeMailSender();
    const harness = await renderUseReceiptDispatch(pdfSharer, mailSender);

    await act(async () => {
      await harness.current.shareReceipt();
    });

    expect(harness.current.status).toBe('failed');
    expect(harness.current.error).toBe('No se pudo compartir el recibo.');
  });

  it('sends the built subject/body with the pdf attached when mail succeeds', async () => {
    const pdfSharer = new FakePdfSharer();
    const mailSender = new FakeMailSender();
    mailSender.result = 'sent';
    const harness = await renderUseReceiptDispatch(pdfSharer, mailSender);

    await act(async () => {
      await harness.current.sendReceiptByMail();
    });

    expect(mailSender.lastOptions).toEqual({
      subject: 'Recibo de salarios — junio de 2026',
      body: expect.stringContaining(FAKE_EMPLOYEE.name),
      attachmentUris: [FAKE_URI],
    });
    expect(harness.current.status).toBe('sent');
    expect(harness.current.error).toBeNull();
  });

  it('is neutral (no error) when the mail composer is cancelled', async () => {
    const pdfSharer = new FakePdfSharer();
    const mailSender = new FakeMailSender();
    mailSender.result = 'cancelled';
    const harness = await renderUseReceiptDispatch(pdfSharer, mailSender);

    await act(async () => {
      await harness.current.sendReceiptByMail();
    });

    expect(harness.current.status).toBe('cancelled');
    expect(harness.current.error).toBeNull();
  });

  it('surfaces a Spanish error when sending fails', async () => {
    const pdfSharer = new FakePdfSharer();
    const mailSender = new FakeMailSender();
    mailSender.send = async () => {
      throw new Error('native failure');
    };
    const harness = await renderUseReceiptDispatch(pdfSharer, mailSender);

    await act(async () => {
      await harness.current.sendReceiptByMail();
    });

    expect(harness.current.status).toBe('failed');
    expect(harness.current.error).toBe('No se pudo enviar el recibo.');
  });

  it('surfaces mailAvailable=false when MailSender.isAvailable() resolves false', async () => {
    const pdfSharer = new FakePdfSharer();
    const mailSender = new FakeMailSender();
    mailSender.available = false;
    const harness = await renderUseReceiptDispatch(pdfSharer, mailSender);

    expect(harness.current.mailAvailable).toBe(false);
  });

  it('surfaces sharingAvailable=false when PdfSharer.isAvailable() resolves false', async () => {
    const pdfSharer = new FakePdfSharer();
    pdfSharer.available = false;
    const mailSender = new FakeMailSender();
    const harness = await renderUseReceiptDispatch(pdfSharer, mailSender);

    expect(harness.current.sharingAvailable).toBe(false);
  });

  it('does not call share/send when no receipt uri has been generated yet', async () => {
    const pdfSharer = new FakePdfSharer();
    const mailSender = new FakeMailSender();
    const harness = await renderUseReceiptDispatch(pdfSharer, mailSender, null, null);

    await act(async () => {
      await harness.current.shareReceipt();
      await harness.current.sendReceiptByMail();
    });

    expect(pdfSharer.shareCallCount).toBe(0);
    expect(mailSender.lastOptions).toBeNull();
    expect(harness.current.status).toBe('idle');
  });

  describe('protected receipts (spec R11)', () => {
    const PROTECTED_SENTENCE = 'El archivo está protegido con contraseña para evitar aperturas accidentales.';

    async function sendProtected(employee: Employee) {
      const pdfSharer = new FakePdfSharer();
      const mailSender = new FakeMailSender();
      const harness = await renderUseReceiptDispatch(pdfSharer, mailSender, FAKE_RUN, FAKE_URI, {
        encrypted: true,
        employee,
      });
      await act(async () => {
        await harness.current.sendReceiptByMail();
      });
      return { mailSender, harness };
    }

    it('uses the NIF wording when the password comes from the document (S1)', async () => {
      const { mailSender, harness } = await sendProtected(makeEmployee({ nif: '00000000T' }));

      expect(mailSender.lastOptions?.body).toContain(`${PROTECTED_SENTENCE} La contraseña es su NIF/NIE,`);
      expect(mailSender.lastOptions?.attachmentUris).toEqual([FAKE_URI]);
      expect(harness.current.status).toBe('sent');
    });

    it('uses the "facilitado" wording and never the override value when the password is the override (S2)', async () => {
      const { mailSender } = await sendProtected(
        makeEmployee({ nif: '00000000T', receiptPasswordOverride: 'clave 1' }),
      );

      const body = mailSender.lastOptions?.body ?? '';
      expect(body).toContain('La contraseña es la que le hemos facilitado.');
      expect(body).not.toContain('clave 1');
      expect(body).not.toContain('NIF');
    });

    it('falls back to the override wording, never claiming the NIF, when the password can no longer be derived', async () => {
      const { mailSender } = await sendProtected(makeEmployee({ nif: null, receiptPasswordOverride: null }));

      const body = mailSender.lastOptions?.body ?? '';
      expect(body).toContain('La contraseña es la que le hemos facilitado.');
      expect(body).not.toContain('NIF');
    });

    it('keeps the plain body when the receipt is not encrypted, even if the employee has a document (S3)', async () => {
      const pdfSharer = new FakePdfSharer();
      const mailSender = new FakeMailSender();
      const harness = await renderUseReceiptDispatch(pdfSharer, mailSender, FAKE_RUN, FAKE_URI, {
        encrypted: false,
        employee: makeEmployee({ nif: '00000000T' }),
      });

      await act(async () => {
        await harness.current.sendReceiptByMail();
      });

      expect(mailSender.lastOptions?.body).not.toContain('protegido');
    });

    it('shares the same uri whether or not the receipt is encrypted (S4)', async () => {
      const pdfSharer = new FakePdfSharer();
      const harness = await renderUseReceiptDispatch(pdfSharer, new FakeMailSender(), FAKE_RUN, FAKE_URI, {
        encrypted: true,
        employee: makeEmployee({ nif: '00000000T' }),
      });

      await act(async () => {
        await harness.current.shareReceipt();
      });

      expect(pdfSharer.lastSharedUri).toBe(FAKE_URI);
    });
  });
});
