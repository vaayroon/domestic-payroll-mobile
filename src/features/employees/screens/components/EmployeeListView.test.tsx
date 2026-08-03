import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { EmployeeListView, type EmployeeListViewProps } from './EmployeeListView';

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
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'new-payroll-run-button' }).props.onPress();
    });

    expect(onNewPayrollRun).toHaveBeenCalledTimes(1);
  });
});
