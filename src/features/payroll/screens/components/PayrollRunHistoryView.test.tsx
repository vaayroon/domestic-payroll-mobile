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
  onOpen: () => {},
  onSend: () => {},
  sharingAvailable: true,
  mailAvailable: true,
  dispatchStatus: 'idle',
  dispatchError: null,
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

  it('shows the success banner once a receipt was generated', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], lastUri: 'file:///fake/recibo-1.pdf' });

    const success = renderer.root.findByProps({ testID: 'payroll-run-history-success' });
    expect(success.props.children).toBe('Recibo generado.');
  });

  it('does not show the open/send actions when no receipt was generated yet', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], lastUri: null });

    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-open' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-send' })).toThrow();
  });

  it('shows the open/send actions once lastUri is set, both enabled', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/recibo-1.pdf',
      sharingAvailable: true,
      mailAvailable: true,
    });

    expect(renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.disabled).toBe(false);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-send' }).props.disabled).toBe(false);
    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-mail-unavailable' })).toThrow();
  });

  it('fires onOpen when "Abrir recibo" is pressed', async () => {
    const onOpen = jest.fn();
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/recibo-1.pdf',
      onOpen,
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.onPress();
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('fires onSend when "Enviar por correo" is pressed', async () => {
    const onSend = jest.fn();
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/recibo-1.pdf',
      onSend,
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'payroll-run-history-send' }).props.onPress();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('disables "Enviar por correo" and shows the Spanish hint when mail is unavailable', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/recibo-1.pdf',
      mailAvailable: false,
    });

    expect(renderer.root.findByProps({ testID: 'payroll-run-history-send' }).props.disabled).toBe(true);
    const hint = renderer.root.findByProps({ testID: 'payroll-run-history-mail-unavailable' });
    expect(hint.props.children).toBe('No hay ninguna app de correo configurada en este dispositivo.');
    // "Abrir recibo" remains the escape hatch (decision: disable-and-explain, not share-sheet fallback).
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.disabled).toBe(false);
  });

  it('disables "Abrir recibo" when sharing is unavailable', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/recibo-1.pdf',
      sharingAvailable: false,
    });

    expect(renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.disabled).toBe(true);
  });

  it('shows the Spanish sent confirmation when dispatchStatus is "sent"', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/recibo-1.pdf',
      dispatchStatus: 'sent',
    });

    const sent = renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-sent' });
    expect(sent.props.children).toBe('Recibo enviado.');
  });

  it('shows the Spanish failure message when dispatchStatus is "failed"', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/recibo-1.pdf',
      dispatchStatus: 'failed',
      dispatchError: 'No se pudo enviar el recibo.',
    });

    const failed = renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-failed' });
    expect(failed.props.children).toBe('No se pudo enviar el recibo.');
  });

  it('renders nothing extra when dispatchStatus is "cancelled" (neutral)', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/recibo-1.pdf',
      dispatchStatus: 'cancelled',
    });

    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-sent' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-failed' })).toThrow();
  });
});
