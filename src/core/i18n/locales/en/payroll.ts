import type { Catalog } from '../../catalog';
import type { payroll as es } from '../es/payroll';

export const payroll: Catalog<typeof es> = {
  form: {
    employee: 'Employee',
    employeesLoading: 'Loading employees…',
    employeesEmpty: 'There are no active employees. Add one first.',
    period: 'Period',
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
};
