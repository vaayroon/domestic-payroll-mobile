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
  periodStartDate: null,
  periodEndDate: null,
  baseCotizacionCents: null,
  contractType: null,
  employerTotalEfectivoCents: null,
  createdAt: 0,
};

const OTHER_RUN: PayrollRun = { ...FAKE_RUN, id: 'payroll-run-fake-2', periodMonth: 7 };

const baseProps: PayrollRunHistoryViewProps = {
  runs: [],
  loading: false,
  error: null,
  generating: false,
  generatingRunId: null,
  generateError: null,
  lastUri: null,
  lastEncrypted: false,
  onGenerate: () => {},
  onOpen: () => {},
  onShare: () => {},
  onSendMail: () => {},
  onEncrypt: () => {},
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

function rowLabel(renderer: ReactTestRenderer, run: PayrollRun): unknown {
  return renderer.root
    .findByProps({ testID: `payroll-run-history-generate-${run.id}` })
    .findByType(Text).props.children;
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
    const renderer = await renderView({ ...baseProps, error: { code: 'read_failed', detail: 'boom' } });

    const errorNode = renderer.root.findByProps({ testID: 'payroll-run-history-error' });
    expect(errorNode.props.children).toBe('boom');
    const messageNode = renderer.root.findByProps({ testID: 'payroll-run-history-error-message' });
    expect(messageNode.props.children).toBe('No se pudo cargar el historial de nóminas.');
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

  it('keeps every "Generar recibo" row enabled while nothing is generating', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN, OTHER_RUN] });

    for (const run of [FAKE_RUN, OTHER_RUN]) {
      const row = renderer.root.findByProps({ testID: `payroll-run-history-generate-${run.id}` });
      expect(row.props.disabled).toBe(false);
      expect(rowLabel(renderer, run)).toBe('Generar recibo');
    }
  });

  it('disables every row while a receipt generates but labels "Generando…" only on the row being generated', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN, OTHER_RUN],
      generating: true,
      generatingRunId: OTHER_RUN.id,
    });

    expect(renderer.root.findByProps({ testID: `payroll-run-history-generate-${FAKE_RUN.id}` }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: `payroll-run-history-generate-${OTHER_RUN.id}` }).props.disabled).toBe(true);
    expect(rowLabel(renderer, FAKE_RUN)).toBe('Generar recibo');
    expect(rowLabel(renderer, OTHER_RUN)).toBe('Generando…');
  });

  it('disables every row without relabelling any when the generation was not started from a row', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN, OTHER_RUN],
      generating: true,
      generatingRunId: null,
    });

    for (const run of [FAKE_RUN, OTHER_RUN]) {
      expect(renderer.root.findByProps({ testID: `payroll-run-history-generate-${run.id}` }).props.disabled).toBe(true);
      expect(rowLabel(renderer, run)).toBe('Generar recibo');
    }
  });

  it('shows the generate error message when present', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], generateError: { code: 'failed', detail: 'no se pudo generar' } });

    const errorNode = renderer.root.findByProps({ testID: 'payroll-run-history-generate-error' });
    expect(errorNode.props.children).toBe('no se pudo generar');
  });

  it('shows the success banner once a receipt was generated', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], lastUri: 'file:///fake/cache/Print/recibo-1.pdf' });

    const success = renderer.root.findByProps({ testID: 'payroll-run-history-success' });
    expect(success.props.children).toBe('Recibo generado.');
  });

  it('shows the protected banner and the password hint when the receipt is encrypted', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      lastEncrypted: true,
    });

    const success = renderer.root.findByProps({ testID: 'payroll-run-history-success' });
    expect(success.props.children).toBe('Recibo generado y protegido con contraseña.');
    const hint = renderer.root.findByProps({ testID: 'payroll-run-history-protected-hint' });
    expect(hint.props.children).toBe('Recuerda indicar al empleado cómo abrir el recibo protegido.');
  });

  it('shows no password hint for a plain receipt', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      lastEncrypted: false,
    });

    expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-protected-hint' })).toHaveLength(0);
  });

  it('does not show the receipt actions when no receipt was generated yet', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], lastUri: null });

    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-open' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-share' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-send' })).toThrow();
  });

  it('shows open, share, send and cifrar for a plain receipt, in that order, all enabled', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      sharingAvailable: true,
      mailAvailable: true,
    });

    const actionIds = renderer.root
      .findAll((node) => typeof node.props.testID === 'string' && node.props.onPress !== undefined)
      .map((node) => node.props.testID as string)
      .filter((id) => id.startsWith('payroll-run-history-') && !id.startsWith('payroll-run-history-generate'));
    expect(actionIds).toEqual([
      'payroll-run-history-open',
      'payroll-run-history-share',
      'payroll-run-history-send',
      'payroll-run-history-encrypt',
    ]);

    const label = (testID: string) =>
      renderer.root
        .findByProps({ testID })
        .findAllByType(Text)
        .map((node) => node.props.children);
    expect(label('payroll-run-history-open')).toEqual(['Abrir recibo']);
    expect(label('payroll-run-history-share')).toEqual(['Compartir']);
    expect(label('payroll-run-history-send')).toEqual(['Enviar por correo']);
    expect(label('payroll-run-history-encrypt')).toEqual(['Cifrar']);

    expect(renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.disabled).not.toBe(true);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-share' }).props.disabled).toBe(false);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-send' }).props.disabled).toBe(false);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-encrypt' }).props.disabled).toBe(false);
    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-mail-unavailable' })).toThrow();
  });

  it('hides "Cifrar" when the receipt is already encrypted', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      lastEncrypted: true,
    });

    expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-encrypt' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-open' })).toBeTruthy();
  });

  it('hides "Cifrar" when there is no receipt yet', async () => {
    const renderer = await renderView({ ...baseProps, runs: [FAKE_RUN], lastUri: null, lastEncrypted: false });

    expect(renderer.root.findAllByProps({ testID: 'payroll-run-history-encrypt' })).toHaveLength(0);
  });

  it('fires onEncrypt when "Cifrar" is pressed', async () => {
    const onEncrypt = jest.fn();
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      onEncrypt,
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'payroll-run-history-encrypt' }).props.onPress();
    });

    expect(onEncrypt).toHaveBeenCalledTimes(1);
  });

  it('disables "Cifrar" while a receipt is generating', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      generating: true,
    });

    expect(renderer.root.findByProps({ testID: 'payroll-run-history-encrypt' }).props.disabled).toBe(true);
  });

  it.each(['sharing', 'sending'] as const)(
    'disables "Cifrar" while dispatchStatus is "%s", so the file is not swapped mid-dispatch',
    async (dispatchStatus) => {
      const renderer = await renderView({
        ...baseProps,
        runs: [FAKE_RUN],
        lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
        lastEncrypted: false,
        dispatchStatus,
      });

      expect(renderer.root.findByProps({ testID: 'payroll-run-history-encrypt' }).props.disabled).toBe(true);
    },
  );

  it.each(['idle', 'sent', 'cancelled', 'failed'] as const)(
    'keeps "Cifrar" enabled when dispatchStatus is "%s"',
    async (dispatchStatus) => {
      const renderer = await renderView({
        ...baseProps,
        runs: [FAKE_RUN],
        lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
        lastEncrypted: false,
        dispatchStatus,
      });

      expect(renderer.root.findByProps({ testID: 'payroll-run-history-encrypt' }).props.disabled).toBe(false);
    },
  );

  it('fires onOpen when "Abrir recibo" is pressed', async () => {
    const onOpen = jest.fn();
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      onOpen,
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.onPress();
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('fires onShare when "Compartir" is pressed', async () => {
    const onShare = jest.fn();
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      onShare,
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'payroll-run-history-share' }).props.onPress();
    });

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('fires onSendMail when "Enviar por correo" is pressed', async () => {
    const onSendMail = jest.fn();
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      onSendMail,
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'payroll-run-history-send' }).props.onPress();
    });

    expect(onSendMail).toHaveBeenCalledTimes(1);
  });

  it('disables "Enviar por correo" and shows the Spanish hint when mail is unavailable', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      mailAvailable: false,
    });

    expect(renderer.root.findByProps({ testID: 'payroll-run-history-send' }).props.disabled).toBe(true);
    const hint = renderer.root.findByProps({ testID: 'payroll-run-history-mail-unavailable' });
    expect(hint.props.children).toBe('No hay ninguna app de correo configurada en este dispositivo.');
    // "Abrir recibo" and "Compartir" do not depend on mail availability.
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.disabled).not.toBe(true);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-share' }).props.disabled).toBe(false);
  });

  it('disables "Compartir" but keeps "Abrir recibo" enabled when sharing is unavailable', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      sharingAvailable: false,
    });

    expect(renderer.root.findByProps({ testID: 'payroll-run-history-share' }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.disabled).not.toBe(true);
    expect(renderer.root.findByProps({ testID: 'payroll-run-history-send' }).props.disabled).toBe(false);
  });

  it.each(['sharing', 'sending'] as const)(
    'disables "Compartir" and "Enviar por correo" while dispatchStatus is "%s"',
    async (dispatchStatus) => {
      const renderer = await renderView({
        ...baseProps,
        runs: [FAKE_RUN],
        lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
        dispatchStatus,
      });

      expect(renderer.root.findByProps({ testID: 'payroll-run-history-share' }).props.disabled).toBe(true);
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-send' }).props.disabled).toBe(true);
      expect(renderer.root.findByProps({ testID: 'payroll-run-history-open' }).props.disabled).not.toBe(true);
    },
  );

  it('shows the Spanish sent confirmation when dispatchStatus is "sent"', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      dispatchStatus: 'sent',
    });

    const sent = renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-sent' });
    expect(sent.props.children).toBe('Recibo enviado.');
  });

  it('shows the Spanish failure message when dispatchStatus is "failed"', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      dispatchStatus: 'failed',
      dispatchError: 'send_failed',
    });

    const failed = renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-failed' });
    expect(failed.props.children).toBe('No se pudo enviar el recibo.');
  });

  it('renders nothing extra when dispatchStatus is "cancelled" (neutral)', async () => {
    const renderer = await renderView({
      ...baseProps,
      runs: [FAKE_RUN],
      lastUri: 'file:///fake/cache/Print/recibo-1.pdf',
      dispatchStatus: 'cancelled',
    });

    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-sent' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'payroll-run-history-dispatch-failed' })).toThrow();
  });
});
