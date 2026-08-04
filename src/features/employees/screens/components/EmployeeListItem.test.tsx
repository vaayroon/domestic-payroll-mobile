/**
 * Render test for `EmployeeListItem` (verify-report #660, W2): renders the
 * name and EUR-formatted base gross, and fires `onEdit`/`onDeactivate` with
 * the employee id when the corresponding button is pressed.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { Employee } from '@/types';
import { cents, toEuros } from '@/types/money';

import { EmployeeListItem } from './EmployeeListItem';

const EUR_FORMATTER = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

// Obviously-fake placeholder identifier/name only (CLAUDE.md §6).
const FAKE_EMPLOYEE: Employee = {
  id: 'employee-fake-1',
  employerId: 'employer-fake-1',
  name: 'Empleada de Prueba',
  nif: null,
  naf: null,
  baseGrossCents: cents(90050),
  active: true,
  altaDate: null,
  bajaDate: null,
  contractType: 'INDEFINIDO',
};

async function renderItem(
  onEdit: (id: string) => void,
  onDeactivate: (id: string) => void,
  onViewHistory: (id: string) => void = () => {},
): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <EmployeeListItem employee={FAKE_EMPLOYEE} onEdit={onEdit} onDeactivate={onDeactivate} onViewHistory={onViewHistory} />,
    );
  });
  return renderer;
}

describe('EmployeeListItem', () => {
  it('renders the employee name and EUR-formatted base gross', async () => {
    const renderer = await renderItem(() => {}, () => {});

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual(FAKE_EMPLOYEE.name);
    expect(texts).toContainEqual(EUR_FORMATTER.format(toEuros(FAKE_EMPLOYEE.baseGrossCents)));
  });

  it('fires onEdit with the employee id when "Editar" is pressed', async () => {
    const onEdit = jest.fn();
    const renderer = await renderItem(onEdit, () => {});

    act(() => {
      renderer.root.findByProps({ testID: 'employee-list-item-edit' }).props.onPress();
    });

    expect(onEdit).toHaveBeenCalledWith(FAKE_EMPLOYEE.id);
  });

  it('fires onDeactivate with the employee id when "Eliminar" is pressed', async () => {
    const onDeactivate = jest.fn();
    const renderer = await renderItem(() => {}, onDeactivate);

    act(() => {
      renderer.root.findByProps({ testID: 'employee-list-item-deactivate' }).props.onPress();
    });

    expect(onDeactivate).toHaveBeenCalledWith(FAKE_EMPLOYEE.id);
  });

  it('fires onViewHistory with the employee id when "Historial" is pressed', async () => {
    const onViewHistory = jest.fn();
    const renderer = await renderItem(() => {}, () => {}, onViewHistory);

    act(() => {
      renderer.root.findByProps({ testID: 'employee-list-item-history' }).props.onPress();
    });

    expect(onViewHistory).toHaveBeenCalledWith(FAKE_EMPLOYEE.id);
  });
});
