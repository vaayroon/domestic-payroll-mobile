import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { Employee } from '@/types';
import { cents } from '@/types/money';

import { PayrollRunForm, type PayrollRunFormProps } from './PayrollRunForm';

// `Intl.NumberFormat('es-ES', ...)` inserts a NON-BREAKING SPACE (U+00A0,
// not a regular space) between the amount and the `€` symbol.
const NBSP = '\u00A0';

async function renderForm(props: PayrollRunFormProps): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<PayrollRunForm {...props} />);
  });
  return renderer;
}

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
};

const baseProps: PayrollRunFormProps = {
  employees: [FAKE_EMPLOYEE],
  employeesLoading: false,
  selectedEmployeeId: FAKE_EMPLOYEE.id,
  onSelectEmployee: () => {},
  periodYear: 2026,
  periodMonth: 6,
  onIncrementMonth: () => {},
  onDecrementMonth: () => {},
  extraPayMode: 'EXCLUDE',
  onChangeExtraPayMode: () => {},
  preview: null,
  ratesWarning: null,
  saving: false,
  error: null,
  onSubmit: () => {},
};

describe('PayrollRunForm', () => {
  it('shows the empty-preview placeholder when there is no preview yet', async () => {
    const renderer = await renderForm(baseProps);

    expect(renderer.root.findByProps({ testID: 'payroll-run-form-preview-empty' })).toBeTruthy();
  });

  it('shows the year_not_loaded rates warning instead of the preview or the empty placeholder', async () => {
    const renderer = await renderForm({
      ...baseProps,
      ratesWarning: 'No se han cargado las tarifas de cotización para este año. No se puede calcular la nómina.',
    });

    const warning = renderer.root.findByProps({ testID: 'payroll-run-form-rates-warning' });
    expect(warning.props.children).toBe(
      'No se han cargado las tarifas de cotización para este año. No se puede calcular la nómina.',
    );
    expect(() => renderer.root.findByProps({ testID: 'payroll-run-form-preview-empty' })).toThrow();
  });

  it('formats the preview amounts in Spanish EUR (design ADR-4)', async () => {
    const renderer = await renderForm({
      ...baseProps,
      preview: {
        grossCents: cents(90000),
        ssDeductionCents: cents(10000),
        netCents: cents(80000),
        prorated: false,
        extraCents: cents(0),
        daysWorked: 30,
        daysInMonth: 30,
      },
    });

    expect(renderer.root.findByProps({ testID: 'payroll-run-form-preview-gross' }).props.children).toBe(`900,00${NBSP}€`);
    expect(renderer.root.findByProps({ testID: 'payroll-run-form-preview-ss' }).props.children).toBe(`100,00${NBSP}€`);
    expect(renderer.root.findByProps({ testID: 'payroll-run-form-preview-net' }).props.children).toBe(`800,00${NBSP}€`);
  });

  it('shows the prorated note only when the preview is prorated', async () => {
    const rendererProrated = await renderForm({
      ...baseProps,
      preview: {
        grossCents: cents(44254),
        ssDeductionCents: cents(0),
        netCents: cents(44254),
        prorated: true,
        extraCents: cents(44254),
        daysWorked: 0,
        daysInMonth: 30,
      },
    });
    expect(rendererProrated.root.findByProps({ testID: 'payroll-run-form-preview-prorated' })).toBeTruthy();

    const rendererFull = await renderForm({
      ...baseProps,
      preview: {
        grossCents: cents(90000),
        ssDeductionCents: cents(10000),
        netCents: cents(80000),
        prorated: false,
        extraCents: cents(0),
        daysWorked: 30,
        daysInMonth: 30,
      },
    });
    expect(() => rendererFull.root.findByProps({ testID: 'payroll-run-form-preview-prorated' })).toThrow();
  });

  it('shows the duplicate/error message when present', async () => {
    const renderer = await renderForm({ ...baseProps, error: 'Ya existe una nómina para este periodo.' });

    const errorNode = renderer.root.findByProps({ testID: 'payroll-run-form-error' });
    expect(errorNode.props.children).toBe('Ya existe una nómina para este periodo.');
  });

  it('disables the submit button while saving and shows the saving label', async () => {
    const renderer = await renderForm({ ...baseProps, saving: true });

    const submit = renderer.root.findByProps({ testID: 'payroll-run-form-submit' });
    expect(submit.props.disabled).toBe(true);

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('Guardando…');
  });

  it('fires onSubmit when the submit button is pressed', async () => {
    const onSubmit = jest.fn();
    const renderer = await renderForm({ ...baseProps, onSubmit });

    await act(async () => {
      renderer.root.findByProps({ testID: 'payroll-run-form-submit' }).props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('fires onSelectEmployee with the employee id when a row is pressed', async () => {
    const onSelectEmployee = jest.fn();
    const renderer = await renderForm({ ...baseProps, onSelectEmployee });

    await act(async () => {
      renderer.root.findByProps({ testID: `payroll-run-form-employee-${FAKE_EMPLOYEE.id}` }).props.onPress();
    });

    expect(onSelectEmployee).toHaveBeenCalledWith(FAKE_EMPLOYEE.id);
  });

  it('fires onChangeExtraPayMode when a mode row is pressed', async () => {
    const onChangeExtraPayMode = jest.fn();
    const renderer = await renderForm({ ...baseProps, onChangeExtraPayMode });

    await act(async () => {
      renderer.root.findByProps({ testID: 'payroll-run-form-extra-mode-PRORATE' }).props.onPress();
    });

    expect(onChangeExtraPayMode).toHaveBeenCalledWith('PRORATE');
  });
});
