/**
 * Render test for `PayrollRunHistoryView` (spec "payroll-run-history"):
 * renders list/loading/error/empty states, fires `onGenerate` with the
 * pressed row's run, and shows the success banner with `lastUri` when
 * present. Mirrors `EmployeeListView.test.tsx`'s style.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { PayrollRun } from '@/types';
import { cents } from '@/types/money';

import { PayrollRunHistoryView, type PayrollRunHistoryViewProps } from './PayrollRunHistoryView';

// `Intl.NumberFormat('es-ES', ...)` inserts a NON-BREAKING SPACE (U+00A0,
// not a regular space) between the amount and the `€` symbol.
const NBSP = ' ';

// Obviously-fake placeholder identifiers/amounts only (CLAUDE.md §6).
const FAKE_RUN: PayrollRun = {
  id: 'payroll-run-fake-1',
  employeeId: 'employee-fake-1',
  periodYear: 2026,
  periodMonth: 6,
  grossCents: cents(90000),
  ssDeductionCents: cents(10000),
  netCents: cents(80000),
  prorated: false,
  extraCents: cents(0),
  daysWorked: 30,
  daysInMonth: 30,
  createdAt: 0,
};

const baseProps: PayrollRunHistoryViewProps = {
  runs: [],
  loading: false,
  error: null,
  generating: false,
  generateError: null,
  lastUri: null,
  onGenerate: () => {},
};

async function renderView(props: PayrollRunHistoryViewProps): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<PayrollRunHistoryView {...props} />);
  });
  return renderer;
}

describe('PayrollRunHistoryView', () => {
  it('shows the Spanish empty state when there are no runs', async () => {
    const renderer = await renderView(baseProps);

    const empty = renderer.root.findByProps({ testID: 'payroll-run-history-empty' });
    expect(empty.props.children).toBe('Aún no hay nóminas generadas para este empleado.');
  });

  it('shows a loading indicator instead of the empty state while loading', async () => {
    const renderer = await renderView({ ...baseProps, loading: true });

    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-empty' })).toThrow();
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-loading' })).toBeTruthy();
  });

  it('shows the error message when present', async () => {
    const renderer = await renderView({ ...baseProps, error: 'boom' });

    const errorNode = renderer.root.findByProps({ testID: 'payroll-run-history-error' });
    expect(errorNode.props.children).toBe('boom');
  });

  it('renders each run’s período and líquido', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN] });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('junio de 2026');
    expect(texts).toContainEqual(`800,00${NBSP}€`);
  });

  it('fires onGenerate with the run when "Generar recibo" is pressed', async () => {
    const onGenerate = jest.fn();
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], onGenerate });

    await act(async () => {
      renderer.root.findByProps({ testID: `payroll-run-history-generate-${FAKE_RUN.id}` }).props.onPress();
    });

    expect(onGenerate).toHaveBeenCalledWith(FAKE_RUN);
  });

  it('shows the generate error message when present', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], generateError: 'no se pudo generar' });

    const errorNode = renderer.root.findByProps({ testID: 'payroll-run-history-generate-error' });
    expect(errorNode.props.children).toBe('no se pudo generar');
  });

  it('shows the success banner with the generated file uri', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], lastUri: 'file:///fake/recibo-1.pdf' });

    const success = renderer.root.findByProps({ testID: 'payroll-run-history-success' });
    expect(success.props.children).toBe('Recibo generado: file:///fake/recibo-1.pdf');
  });
});
