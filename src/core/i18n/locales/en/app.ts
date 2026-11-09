import type { Catalog } from '../../catalog';
import type { app as es } from '../es/app';

export const app: Catalog<typeof es> = {
  settingsLink: 'Settings',
  startup: {
    loading: 'Loading…',
    error: 'The app could not start. Please restart it.',
  },
  titles: {
    employees: 'Employees',
    newEmployee: 'New employee',
    editEmployee: 'Edit employee',
    newPayroll: 'New payroll',
    payrollHistory: 'Payroll history',
    receipt: 'Payslip',
    employerData: 'Employer details',
    reminder: 'Monthly reminder',
    signature: 'Signature',
    receiptFileName: 'File name',
  },
};
