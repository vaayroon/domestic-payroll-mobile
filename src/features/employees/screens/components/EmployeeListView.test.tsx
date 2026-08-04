import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { Employee } from '@/types';
import { cents } from '@/types/money';

import { EmployeeListView, type EmployeeListViewProps } from './EmployeeListView';

// Obviously-fake placeholder identifier/name only (CLAUDE.md §6).
const FAKE_EMPLOYEE: Employee = {
  id: 'employee-fake-1',
  employerId: 'employer-fake-1',
  name: 'Empleada de Prueba',
  nif: null,
  naf: null,
  baseGrossCents: cents(90000),
  active: true,
  altaDate: null,
  bajaDate: null,
  contractType: 'INDEFINIDO',
};

async function renderListView(props: EmployeeListViewProps): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<EmployeeListView {...props} />);
  });
  return renderer;
}

describe('EmployeeListView', () => {
  it('shows the Spanish empty state when there are no employees', async () => {
    const renderer = await renderListView({
      employees: [],
      loading: false,
      error: null,
      onAdd: () => {},
      onEdit: () => {},
      onDeactivate: () => {},
      onNewPayrollRun: () => {},
      onViewHistory: () => {},
    });

    const empty = renderer.root.findByProps({ testID: 'employee-list-empty' });
    expect(empty.props.children).toBe('No hay empleados. Añade el primero.');
  });

  it('shows a loading indicator instead of the empty state while loading', async () => {
    const renderer = await renderListView({
      employees: [],
      loading: true,
      error: null,
      onAdd: () => {},
      onEdit: () => {},
      onDeactivate: () => {},
      onNewPayrollRun: () => {},
      onViewHistory: () => {},
    });

    expect(() => renderer.root.findByProps({ testID: 'employee-list-empty' })).toThrow();
    expect(renderer.root.findByProps({ testID: 'employee-list-loading' })).toBeTruthy();
  });

  it('shows the error message when present', async () => {
    const renderer = await renderListView({
      employees: [],
      loading: false,
      error: 'boom',
      onAdd: () => {},
      onEdit: () => {},
      onDeactivate: () => {},
      onNewPayrollRun: () => {},
      onViewHistory: () => {},
    });

    const error = renderer.root.findByProps({ testID: 'employee-list-error' });
    expect(error.props.children).toBe('boom');
  });

  it('fires onNewPayrollRun when the "Nueva nómina" button is pressed', async () => {
    const onNewPayrollRun = jest.fn();
    const renderer = await renderListView({
      employees: [],
      loading: false,
      error: null,
      onAdd: () => {},
      onEdit: () => {},
      onDeactivate: () => {},
      onNewPayrollRun,
      onViewHistory: () => {},
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'new-payroll-run-button' }).props.onPress();
    });

    expect(onNewPayrollRun).toHaveBeenCalledTimes(1);
  });

  it('fires onViewHistory with the employee id when "Historial" is pressed', async () => {
    const onViewHistory = jest.fn();
    const renderer = await renderListView({
      employees: [FAKE_EMPLOYEE],
      loading: false,
      error: null,
      onAdd: () => {},
      onEdit: () => {},
      onDeactivate: () => {},
      onNewPayrollRun: () => {},
      onViewHistory,
    });

    act(() => {
      renderer.root.findByProps({ testID: 'employee-list-item-history' }).props.onPress();
    });

    expect(onViewHistory).toHaveBeenCalledWith(FAKE_EMPLOYEE.id);
  });
});
