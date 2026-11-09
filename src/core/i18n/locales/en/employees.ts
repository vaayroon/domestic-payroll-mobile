import type { Catalog } from '../../catalog';
import type { employees as es } from '../es/employees';

export const employees: Catalog<typeof es> = {
  list: {
    title: 'Employees',
    newPayrollRun: 'New payroll',
    add: 'Add employee',
    loading: 'Loading…',
    empty: 'No employees yet. Add the first one.',
    errors: {
      read_failed: 'Could not load the employees.',
    },
    item: {
      history: 'History',
      edit: 'Edit',
      remove: 'Delete',
    },
  },
  edit: {
    loading: 'Loading…',
    notFound: 'Employee not found.',
    errors: {
      read_failed: 'Could not load the employee.',
    },
  },
  form: {
    submitCreate: 'Save',
    submitEdit: 'Save changes',
    saving: 'Saving…',
    saveFailed: 'Could not save: {{detail}}',
    labels: {
      name: 'Name',
      nif: 'NIF (optional)',
      naf: 'NAF (optional)',
      grupoCotizacion: 'Grupo de cotización (optional)',
      baseGross: 'Gross salary',
      alta: 'Alta date (optional)',
      baja: 'Baja date (optional)',
      contractType: 'Contract type',
      receiptEncryption: 'Protect the payslip with a password',
      receiptPasswordOverride: 'Own payslip password (optional)',
      receiptFileName: 'Payslip file name',
    },
    placeholders: {
      name: 'Employee name',
      nif: 'NIF',
      naf: 'NAF',
      grupoCotizacion: 'Grupo de cotización',
      baseGross: '900,00',
      receiptPasswordOverride: 'Own password',
    },
    contractTypes: {
      INDEFINIDO: 'Indefinite',
      TEMPORAL: 'Temporary',
    },
    fileNameOptions: {
      inherit: 'Same as the general setting',
      auto: 'Automatic name',
    },
    helpers: {
      grupoCotizacion:
        'Under the Special Regime for Household Employees the Tesorería General (Social Security) does not usually assign a grupo de cotización (contribution group): leaving it blank is normal. Fill it in only if it appears in your Social Security paperwork.',
      receiptEncryption:
        'Protects the payslip with a password so it is not opened by accident. It is not strong security: the NIF/NIE (tax ID) is not a secret.',
      receiptPasswordOverride:
        'If left empty, the password will be the NIF/NIE in capital letters, without spaces or hyphens. Only letters, numbers and basic symbols are allowed (no accents or ñ), up to {{max}} characters.',
      receiptFileName:
        'The file name is visible when you share or send it, even if the payslip is password-protected.',
    },
    errors: {
      name: {
        required: 'The name is required.',
      },
      nif: {
        invalid: 'Invalid NIF/NIE.',
      },
      naf: {
        invalid: 'Invalid NAF.',
      },
      grupoCotizacion: {
        too_long: 'Use at most 40 characters.',
      },
      baseGross: {
        empty: 'Enter the gross salary.',
        not_a_number: 'Enter a valid number (e.g. 900 or 900,50).',
        negative: 'The amount cannot be negative.',
        too_many_decimals: 'Use at most two decimals.',
        not_positive: 'The gross salary must be greater than zero.',
      },
      alta: {
        invalid_date: 'Enter a valid date ({{hint}}).',
      },
      baja: {
        invalid_date: 'Enter a valid date ({{hint}}).',
        before_alta: 'The baja date cannot be earlier than the alta date.',
      },
      contractType: {
        required: 'Select the contract type.',
      },
      receiptEncryptionEnabled: {
        password_unavailable:
          "To protect the payslip, enter the employee's NIF/NIE or an own password.",
      },
      receiptPasswordOverride: {
        too_long: 'The password is too long. Use at most {{max}} characters.',
        invalid_characters:
          'The password contains characters that are not allowed. Use only letters, numbers and basic symbols, without accents or ñ.',
      },
    },
  },
};
