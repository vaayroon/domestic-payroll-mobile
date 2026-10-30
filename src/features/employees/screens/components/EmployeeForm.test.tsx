import { Switch, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { FormScrollView, RECEIPT_FILE_NAME_FORMAT_EXAMPLES, RECEIPT_FILE_NAME_FORMAT_IDS } from '@/core';

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
  values: {
    name: '',
    nif: '',
    naf: '',
    baseGross: '',
    alta: '',
    baja: '',
    grupoCotizacion: '',
    contractType: 'INDEFINIDO',
    receiptEncryptionEnabled: false,
    receiptPasswordOverride: '',
    receiptFileNameFormat: null,
  },
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

  it('maps the nif invalid error code to a Spanish message', async () => {
    const renderer = await renderForm({ ...baseProps, errors: { nif: 'invalid' } });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('NIF/NIE no válido.');
  });

  it('maps the naf invalid error code to a Spanish message', async () => {
    const renderer = await renderForm({ ...baseProps, errors: { naf: 'invalid' } });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('NAF no válido.');
  });

  it('renders the grupo de cotización field with its label, helper text and current value', async () => {
    const renderer = await renderForm({
      ...baseProps,
      values: { ...baseProps.values, grupoCotizacion: '7' },
    });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('Grupo de cotización (opcional)');
    expect(texts).toContainEqual(
      'En el Sistema Especial de Empleados de Hogar la Tesorería General no suele asignar grupo de cotización: lo normal es dejarlo en blanco. Rellénalo solo si aparece en tu documentación de la Seguridad Social.',
    );
    expect(renderer.root.findByProps({ testID: 'employee-form-grupo-cotizacion' }).props.value).toBe('7');
  });

  it('fires onChangeField with the typed grupo de cotización', async () => {
    const onChangeField = jest.fn();
    const renderer = await renderForm({ ...baseProps, onChangeField });

    await act(async () => {
      renderer.root.findByProps({ testID: 'employee-form-grupo-cotizacion' }).props.onChangeText('7');
    });

    expect(onChangeField).toHaveBeenCalledWith('grupoCotizacion', '7');
  });

  it('maps the grupoCotizacion too_long error code to a Spanish message', async () => {
    const renderer = await renderForm({ ...baseProps, errors: { grupoCotizacion: 'too_long' } });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('Usa como máximo 40 caracteres.');
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

  it('maps the contractType required error code to a Spanish message', async () => {
    const renderer = await renderForm({ ...baseProps, errors: { contractType: 'required' } });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('Selecciona el tipo de contrato.');
  });

  it('highlights the selected contractType option', async () => {
    const renderer = await renderForm({ ...baseProps, values: { ...baseProps.values, contractType: 'TEMPORAL' } });

    const temporal = renderer.root.findByProps({ testID: 'employee-form-contract-type-TEMPORAL' });
    expect(temporal.props.onPress).toBeInstanceOf(Function);
  });

  it('fires onChangeField with the pressed contractType option', async () => {
    const onChangeField = jest.fn();
    const renderer = await renderForm({ ...baseProps, onChangeField });

    await act(async () => {
      renderer.root.findByProps({ testID: 'employee-form-contract-type-TEMPORAL' }).props.onPress();
    });

    expect(onChangeField).toHaveBeenCalledWith('contractType', 'TEMPORAL');
  });

  describe('receipt protection', () => {
    const textsOf = (renderer: ReactTestRenderer) =>
      renderer.root.findAllByType(Text).map((node) => node.props.children);

    it('renders the protection switch with its label and a non-overclaiming helper', async () => {
      const renderer = await renderForm(baseProps);

      const texts = textsOf(renderer);
      expect(texts).toContainEqual('Proteger el recibo con contraseña');
      expect(texts).toContainEqual(
        'Protege el recibo con contraseña para evitar que se abra por descuido. No es una medida de seguridad fuerte: el NIF/NIE no es un secreto.',
      );
      const toggle = renderer.root.findByType(Switch);
      expect(toggle.props.testID).toBe('employee-form-receipt-encryption');
      expect(toggle.props.value).toBe(false);
    });

    it('reflects an enabled preference in the switch', async () => {
      const renderer = await renderForm({
        ...baseProps,
        values: { ...baseProps.values, receiptEncryptionEnabled: true },
      });

      expect(renderer.root.findByType(Switch).props.value).toBe(true);
    });

    it('fires onChangeField with a boolean when the switch is toggled', async () => {
      const onChangeField = jest.fn();
      const renderer = await renderForm({ ...baseProps, onChangeField });

      await act(async () => {
        renderer.root.findByType(Switch).props.onValueChange(true);
      });

      expect(onChangeField).toHaveBeenCalledWith('receiptEncryptionEnabled', true);
    });

    it('renders the own-password input as readable, with the NIF/NIE default and the character rules in the helper', async () => {
      const renderer = await renderForm({
        ...baseProps,
        values: { ...baseProps.values, receiptPasswordOverride: 'clave 1' },
      });

      const texts = textsOf(renderer);
      expect(texts).toContainEqual('Contraseña propia del recibo (opcional)');
      expect(texts).toContainEqual(
        'Si la dejas vacía, la contraseña será el NIF/NIE en mayúsculas, sin espacios ni guiones. Solo se admiten letras, números y símbolos básicos (sin acentos ni ñ), hasta 32 caracteres.',
      );
      const input = renderer.root.findByProps({ testID: 'employee-form-receipt-password-override' });
      expect(input.props.value).toBe('clave 1');
      expect(input.props.autoCapitalize).toBe('none');
      expect(input.props.autoCorrect).toBe(false);
      expect(input.props.secureTextEntry).not.toBe(true);
    });

    it('fires onChangeField with the typed own password', async () => {
      const onChangeField = jest.fn();
      const renderer = await renderForm({ ...baseProps, onChangeField });

      await act(async () => {
        renderer.root.findByProps({ testID: 'employee-form-receipt-password-override' }).props.onChangeText('clave 1');
      });

      expect(onChangeField).toHaveBeenCalledWith('receiptPasswordOverride', 'clave 1');
    });

    it('maps each own-password error code to a Spanish message', async () => {
      const cases: [NonNullable<EmployeeFormErrors['receiptPasswordOverride']>, string][] = [
        ['too_long', 'La contraseña es demasiado larga. Usa como máximo 32 caracteres.'],
        [
          'invalid_characters',
          'La contraseña contiene caracteres no permitidos. Usa solo letras, números y símbolos básicos, sin acentos ni ñ.',
        ],
      ];

      for (const [code, message] of cases) {
        const renderer = await renderForm({ ...baseProps, errors: { receiptPasswordOverride: code } });

        expect(textsOf(renderer)).toContainEqual(message);
      }
    });

    it('explains why the switch cannot be enabled when there is no password source', async () => {
      const renderer = await renderForm({
        ...baseProps,
        errors: { receiptEncryptionEnabled: 'password_unavailable' },
      });

      expect(textsOf(renderer)).toContainEqual(
        'Para proteger el recibo, indica el NIF/NIE del empleado o una contraseña propia.',
      );
    });

    it('never overclaims security in the protection copy', async () => {
      const renderer = await renderForm({
        ...baseProps,
        errors: {
          receiptEncryptionEnabled: 'password_unavailable',
          receiptPasswordOverride: 'invalid_characters',
        },
      });

      const protectionTexts = textsOf(renderer)
        .filter((text): text is string => typeof text === 'string')
        .filter((text) => /contraseña|protege/i.test(text));
      expect(protectionTexts.length).toBeGreaterThanOrEqual(5);
      for (const text of protectionTexts) {
        expect(text).not.toMatch(/seguro|segura|confidencial|imposible de abrir|inviolable/i);
      }
    });
  });

  describe('receipt file name format', () => {
    const HELPER_COPY =
      'El nombre del archivo es visible al compartirlo o enviarlo, aunque el recibo esté protegido con contraseña.';
    const OPTION_TEST_IDS = [
      'inherit',
      'auto',
      'name-month-year',
      'name-year-month',
      'year-month-name',
      'month-year',
    ] as const;

    const textsOf = (renderer: ReactTestRenderer) =>
      renderer.root.findAllByType(Text).map((node) => node.props.children);
    const optionOf = (renderer: ReactTestRenderer, id: string) =>
      renderer.root.findByProps({ testID: `employee-form-receipt-file-name-${id}` });

    it('renders the label, the helper copy verbatim and the six options', async () => {
      const renderer = await renderForm(baseProps);

      const texts = textsOf(renderer);
      expect(texts).toContainEqual('Nombre del archivo del recibo');
      expect(texts).toContainEqual(HELPER_COPY);
      for (const id of OPTION_TEST_IDS) {
        expect(optionOf(renderer, id).props.accessibilityRole).toBe('radio');
      }
    });

    it('labels the general-setting and automatic options, then each format by its builder example', async () => {
      const renderer = await renderForm(baseProps);

      const labelOf = (id: string) => optionOf(renderer, id).findByType(Text).props.children;
      expect(labelOf('inherit')).toBe('Igual que el ajuste general');
      expect(labelOf('auto')).toBe('Nombre automático');
      expect(RECEIPT_FILE_NAME_FORMAT_IDS).toHaveLength(4);
      for (const id of RECEIPT_FILE_NAME_FORMAT_IDS) {
        expect(labelOf(id)).toBe(RECEIPT_FILE_NAME_FORMAT_EXAMPLES[id]);
      }
    });

    it('selects "Igual que el ajuste general" for a new employee and nothing else', async () => {
      const renderer = await renderForm(baseProps);

      const checked = OPTION_TEST_IDS.filter((id) => optionOf(renderer, id).props.accessibilityState.checked);
      expect(checked).toEqual(['inherit']);
    });

    it.each([
      ['auto', 'auto'],
      ['name-year-month', 'name-year-month'],
      ['month-year', 'month-year'],
    ] as const)('selects only the option of the stored format %j', async (format, testId) => {
      const renderer = await renderForm({
        ...baseProps,
        values: { ...baseProps.values, receiptFileNameFormat: format },
      });

      const checked = OPTION_TEST_IDS.filter((id) => optionOf(renderer, id).props.accessibilityState.checked);
      expect(checked).toEqual([testId]);
    });

    it.each([
      ['inherit', null],
      ['auto', 'auto'],
      ['name-month-year', 'name-month-year'],
      ['name-year-month', 'name-year-month'],
      ['year-month-name', 'year-month-name'],
      ['month-year', 'month-year'],
    ] as const)('fires onChangeField with the value of the pressed %s option', async (testId, value) => {
      const onChangeField = jest.fn();
      const renderer = await renderForm({
        ...baseProps,
        values: { ...baseProps.values, receiptFileNameFormat: 'month-year' },
        onChangeField,
      });

      await act(async () => {
        optionOf(renderer, testId).props.onPress();
      });

      expect(onChangeField).toHaveBeenCalledTimes(1);
      expect(onChangeField).toHaveBeenCalledWith('receiptFileNameFormat', value);
    });
  });

  it('keeps the whole form reachable on small screens and above the keyboard', async () => {
    const renderer = await renderForm(baseProps);

    expect(renderer.root.findAllByType(FormScrollView)).toHaveLength(1);
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
