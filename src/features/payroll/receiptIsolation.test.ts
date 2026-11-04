/**
 * Receipt isolation guard (i18n-ui-chrome): the receipt PDF HTML, the mail
 * subject/body and the PDF file name are Spanish-only, whatever the UI
 * language. Lives outside `receipt/` because the lint zone forbids test files
 * in that directory from importing `core/i18n`.
 */

import { buildReceiptFileName, RECEIPT_FILE_NAME_FORMAT_IDS } from '@/core';
import { i18n } from '@/core/i18n';
import {
  FAKE_EMPLOYER as FAKE_EMPLOYER_SEED,
  makeEmployee,
} from '@/features/employees/testing/fixtures';
import type { Employee, Employer, PayrollRun } from '@/types';
import { cents } from '@/types/money';

import { buildReceiptHtml, buildReceiptMailContent, buildReceiptViewModel } from './receipt';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_EMPLOYER: Employer = {
  ...FAKE_EMPLOYER_SEED,
  id: 'employer-fake-1',
  name: 'Empleador de Prueba',
  nif: '00000000T',
  address: 'Calle Falsa 123',
  ccc: '28123456789',
  createdAt: 1_700_000_000_000,
};

const FAKE_EMPLOYEE: Employee = makeEmployee({
  employerId: FAKE_EMPLOYER.id,
  nif: '00000001T',
  naf: '000000000001',
});

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
  baseCotizacionCents: null,
  contractType: null,
  employerTotalEfectivoCents: null,
  createdAt: 1_700_000_000_000,
};

function buildReceiptArtifacts() {
  const html = buildReceiptHtml(
    buildReceiptViewModel({
      run: FAKE_RUN,
      employee: FAKE_EMPLOYEE,
      employer: FAKE_EMPLOYER,
      issuedOnIso: '2026-08-04',
      ratesConfig: null,
      employerSignatureBase64: null,
    }),
  );
  return {
    html,
    plainMail: buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE),
    protectedMail: buildReceiptMailContent(FAKE_RUN, FAKE_EMPLOYEE, 'document'),
    fileNames: RECEIPT_FILE_NAME_FORMAT_IDS.map((format) =>
      buildReceiptFileName(format, FAKE_EMPLOYEE.name, FAKE_RUN.periodYear, FAKE_RUN.periodMonth),
    ),
  };
}

describe('receipt isolation from the UI language', () => {
  it('produces identical HTML, mail and file names under es and en', async () => {
    const underEs = buildReceiptArtifacts();

    await i18n.changeLanguage('en');
    const underEn = buildReceiptArtifacts();

    expect(underEn).toEqual(underEs);
    expect(underEn.plainMail.subject).toBe('Recibo de salarios — junio de 2026');
    expect(underEn.html).toContain('junio de 2026');
  });
});
