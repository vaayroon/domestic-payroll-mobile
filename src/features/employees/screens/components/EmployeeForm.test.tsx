import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { EmployeeFormErrors } from '../../domain';

import { EmployeeForm, type EmployeeFormProps } from './EmployeeForm';

async function renderForm(props: EmployeeFormProps): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<EmployeeForm {...props} />);
  });
  return renderer;
}

const baseProps: EmployeeFormProps = {
  values: { name: '', nif: '', naf: '', baseGross: '', alta: '', baja: '' },
  errors: {},
  onChangeField: () => {},
  onSubmit: () => {},
  saving: false,
  saveError: null,
  submitLabel: 'Guardar',
};

describe('EmployeeForm', () => {
  it('maps the required name error code to a Spanish message', async () => {
    const renderer = await renderForm({ ...baseProps, errors: { name: 'required' } });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('El nombre es obligatorio.');
  });

  it('maps each base gross error code to a Spanish message', async () => {
    const cases: [NonNullable<EmployeeFormErrors['baseGross']>, string][] = [
      ['empty', 'Introduce el salario bruto.'],
      ['not_a_number', 'Introduce un número válido (ej. 900 o 900,50).'],
      ['negative', 'El importe no puede ser negativo.'],
      ['too_many_decimals', 'Usa como máximo dos decimales.'],
      ['not_positive', 'El salario bruto debe ser mayor que cero.'],
    ];

    for (const [code, message] of cases) {
      const renderer = await renderForm({ ...baseProps, errors: { baseGross: code } });

      const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
      expect(texts).toContainEqual(message);
    }
  });

  it('renders the alta/baja date inputs with their current values', async () => {
    const renderer = await renderForm({ ...baseProps, values: { ...baseProps.values, alta: '2026-07-23', baja: '2026-12-31' } });

    expect(renderer.root.findByProps({ testID: 'employee-form-alta' }).props.value).toBe('2026-07-23');
    expect(renderer.root.findByProps({ testID: 'employee-form-baja' }).props.value).toBe('2026-12-31');
  });

  it('maps the alta invalid_date error code to a Spanish message', async () => {
    const renderer = await renderForm({ ...baseProps, errors: { alta: 'invalid_date' } });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('Introduce una fecha válida (AAAA-MM-DD).');
  });

  it('maps each baja error code to a Spanish message', async () => {
    const cases: [NonNullable<EmployeeFormErrors['baja']>, string][] = [
      ['invalid_date', 'Introduce una fecha válida (AAAA-MM-DD).'],
      ['before_alta', 'La fecha de baja no puede ser anterior a la fecha de alta.'],
    ];

    for (const [code, message] of cases) {
      const renderer = await renderForm({ ...baseProps, errors: { baja: code } });

      const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
      expect(texts).toContainEqual(message);
    }
  });

  it('fires onSubmit when the submit button is pressed', async () => {
    const onSubmit = jest.fn();
    const renderer = await renderForm({ ...baseProps, onSubmit });

    await act(async () => {
      renderer.root.findByProps({ testID: 'employee-form-submit' }).props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the save error banner when present', async () => {
    const renderer = await renderForm({ ...baseProps, saveError: 'disk full' });

    const banner = renderer.root.findByProps({ testID: 'employee-form-save-error' });
    expect(String(banner.props.children)).toContain('disk full');
  });
});
