/**
 * English render tests for the employees slice (i18n-ui-chrome, commit 3).
 * The Spanish assertions live in the per-component tests and stay unchanged.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { i18n } from '@/core/i18n';

import { validateEmployeeForm, type EmployeeFormInput } from '../domain';
import { makeEmployee } from '../testing/fixtures';
import { EmployeeForm } from './components/EmployeeForm';
import { EmployeeListItem } from './components/EmployeeListItem';
import { EmployeeListView } from './components/EmployeeListView';

const EMPTY_VALUES: EmployeeFormInput = {
  name: '',
  nif: '',
  naf: '',
  baseGross: '',
  alta: '',
  baja: '',
  grupoCotizacion: '',
  contractType: '',
  receiptEncryptionEnabled: false,
  receiptPasswordOverride: '',
  receiptFileNameFormat: null,
};

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(element);
  });
  return renderer;
}

function texts(renderer: ReactTestRenderer): unknown[] {
  return renderer.root.findAllByType(Text).map((node) => node.props.children);
}

describe('employees slice in English', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('renders the list chrome in English', async () => {
    const renderer = await render(
      <EmployeeListView
        employees={[]}
        loading={false}
        error={null}
        onAdd={() => {}}
        onEdit={() => {}}
        onDeactivate={() => {}}
        onNewPayrollRun={() => {}}
        onViewHistory={() => {}}
      />,
    );

    expect(texts(renderer)).toEqual(
      expect.arrayContaining([
        'Employees',
        'New payroll',
        'Add employee',
        'No employees yet. Add the first one.',
      ]),
    );
  });

  it('maps the list read error code to English and keeps the detail as a secondary line', async () => {
    const renderer = await render(
      <EmployeeListView
        employees={[]}
        loading={false}
        error={{ code: 'read_failed', detail: 'disk I/O error' }}
        onAdd={() => {}}
        onEdit={() => {}}
        onDeactivate={() => {}}
        onNewPayrollRun={() => {}}
        onViewHistory={() => {}}
      />,
    );

    expect(
      renderer.root.findByProps({ testID: 'employee-list-error-message' }).props.children,
    ).toBe('Could not load the employees.');
    expect(renderer.root.findByProps({ testID: 'employee-list-error' }).props.children).toBe(
      'disk I/O error',
    );
  });

  it('renders the row actions in English', async () => {
    const renderer = await render(
      <EmployeeListItem
        employee={makeEmployee()}
        onEdit={() => {}}
        onDeactivate={() => {}}
        onViewHistory={() => {}}
      />,
    );

    expect(texts(renderer)).toEqual(expect.arrayContaining(['History', 'Edit', 'Delete']));
  });

  it('shows the YYYY-MM-DD hint and English validation messages for an invalid form', async () => {
    const values: EmployeeFormInput = { ...EMPTY_VALUES, alta: 'nope', baja: 'nope' };
    const result = validateEmployeeForm(values, 'employer-fake-1');
    if (result.ok) {
      throw new Error('expected the form to be invalid');
    }

    const renderer = await render(
      <EmployeeForm
        values={values}
        errors={result.errors}
        onChangeField={() => {}}
        onSubmit={() => {}}
        saving={false}
        saveError={null}
        submitLabel="Save"
      />,
    );

    const all = texts(renderer);
    expect(all).toEqual(
      expect.arrayContaining([
        'The name is required.',
        'Enter the gross salary.',
        'Enter a valid date (YYYY-MM-DD).',
        'Select the contract type.',
      ]),
    );
    expect(renderer.root.findByProps({ testID: 'employee-form-alta' }).props.placeholder).toBe(
      'YYYY-MM-DD',
    );
    expect(renderer.root.findByProps({ testID: 'employee-form-baja' }).props.placeholder).toBe(
      'YYYY-MM-DD',
    );
  });

  it('keeps legal terms in Spanish with an English gloss and localizes the save banner', async () => {
    const renderer = await render(
      <EmployeeForm
        values={EMPTY_VALUES}
        errors={{}}
        onChangeField={() => {}}
        onSubmit={() => {}}
        saving={false}
        saveError={{ code: 'save_failed', detail: 'disk full' }}
        submitLabel="Save"
      />,
    );

    const all = texts(renderer).map(String);
    expect(all).toContain('Grupo de cotización (optional)');
    expect(all.some((text) => text.includes('grupo de cotización (contribution group)'))).toBe(
      true,
    );
    expect(
      String(renderer.root.findByProps({ testID: 'employee-form-save-error' }).props.children),
    ).toBe('Could not save: disk full');
  });
});
