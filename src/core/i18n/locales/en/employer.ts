import type { Catalog } from '../../catalog';
import type { employer as es } from '../es/employer';

export const employer: Catalog<typeof es> = {
  settings: {
    loading: 'Loading…',
    saving: 'Saving…',
    submit: 'Save changes',
    saveFailed: 'Could not save: {{detail}}',
    labels: {
      name: 'Name',
      nif: 'NIF/NIE (optional)',
      address: 'Address (optional)',
      ccc: 'Social Security account number, CCC (optional)',
      defaultLugar: 'Place of issue (optional)',
    },
    placeholders: {
      name: 'Employer name',
      nif: 'NIF/NIE',
      address: 'Address',
      ccc: 'S.S. no. / CCC',
      defaultLugar: 'City where payslips are issued',
    },
    links: {
      reminder: 'Monthly reminder',
      signature: 'Employer signature',
      receiptFileName: 'Payslip file name',
    },
  },
  errors: {
    name: {
      required: 'The name is required.',
    },
    nif: {
      invalid_format: 'The NIF/NIE format is not valid.',
      invalid_checksum: 'The NIF/NIE control letter is not correct.',
    },
    ccc: {
      invalid_format: 'The Social Security account number (CCC) must have 11 or 12 digits.',
    },
    load: {
      not_found: 'The employer profile was not found.',
    },
  },
  signature: {
    loading: 'Loading…',
    title: 'Employer signature',
    description:
      'Draw your signature once. It will be added automatically to every payslip you generate.',
    deviceOnly: 'The signature is stored on this device only.',
    status: {
      saved: 'Signature saved',
      none: 'No signature saved',
    },
    saving: 'Saving…',
    save: 'Save signature',
    clear: 'Clear',
    delete: 'Delete saved signature',
    errors: {
      empty_canvas: 'Draw your signature before saving.',
      load_failed: 'Could not open the signature pad.',
      capture_failed: 'Could not read the signature.',
      save_failed: 'Could not save the signature.',
    },
  },
  receiptFileName: {
    loading: 'Loading…',
    title: 'Payslip file name',
    helper:
      'The file name is visible when you share or send it, even if the payslip is password-protected.',
    defaultOption: 'Automatic name (random)',
    saving: 'Saving…',
    submit: 'Save',
    errors: {
      save_failed: 'Could not save the setting.',
    },
  },
};
