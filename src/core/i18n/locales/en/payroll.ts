import type { Catalog } from '../../catalog';
import type { payroll as es } from '../es/payroll';

export const payroll: Catalog<typeof es> = {
  form: {
    employee: 'Employee',
    employeesLoading: 'Loading employees…',
    employeesEmpty: 'There are no active employees. Add one first.',
    period: 'Period',
    periodPrevious: 'Previous month',
    periodNext: 'Next month',
    range: 'Days worked range',
    from: 'From',
    to: 'To',
    extraPay: 'Pagas extra (extra payments)',
    extraPayModes: {
      INCLUDE_IN_MONTH: 'Include in the month (June/December)',
      PRORATE: 'Prorate every month',
      EXCLUDE: 'Exclude',
    },
    previewEmpty: 'Select an employee to see the preview.',
    gross: 'Gross:',
    ss: 'SS:',
    net: 'Net:',
    prorated: 'Prorated month.',
    saving: 'Saving…',
    submit: 'Calculate and save payroll',
    errors: {
      range_invalid: 'The start date cannot be after the end date.',
      rates_not_loaded:
        'The contribution rates for this year have not been loaded. The payroll cannot be calculated.',
      select_employee: 'Select an employee.',
      duplicate_run: 'A payroll already exists for {{employee}} in {{month}}/{{year}}.',
    },
  },
  history: {
    title: 'Payroll history',
    loading: 'Loading…',
    empty: 'No payrolls have been generated for this employee yet.',
    generate: 'Generate payslip',
    generating: 'Generating…',
    generated: 'Payslip generated.',
    open: 'Open payslip',
    share: 'Share',
    sendMail: 'Send by email',
    encrypt: 'Encrypt',
    sent: 'Payslip sent.',
  },
  protection: {
    generatedProtected: 'Payslip generated and protected with a password.',
    hint: 'Remember to tell the employee how to open the protected payslip.',
    viewerFailure:
      'The protected payslip could not be opened. Generate it again from the payroll history.',
  },
  dispatch: {
    shareDialogTitle: 'Share payslip',
    mailUnavailable: 'No email app is set up on this device.',
    runMissing: 'The payroll for this payslip was not found.',
    errors: {
      share_failed: 'The payslip could not be shared.',
      send_failed: 'The payslip could not be sent.',
    },
  },
  generate: {
    errors: {
      employee_not_found: 'The employee for this payroll was not found.',
      employer_not_found: 'The employer was not found.',
      encryption_unavailable:
        'Cannot encrypt: this employee has no NIF/NIE and no own password. Add one in their profile.',
      encryption_failed: 'The protected payslip could not be generated. Try again.',
    },
  },
  viewer: {
    failure: 'The payslip could not be displayed. Generate it again from the payroll history.',
    pdfLabel: 'Payslip PDF',
    loadingLabel: 'Loading payslip',
    loading: 'Loading payslip…',
  },
};
