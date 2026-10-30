/**
 * Render test for `ReceiptViewerView` (spec "receipt-pdf-viewer"): the
 * props-only viewer surface. The PDF surface is injected as a prop, so these
 * tests use `FakePdfViewer` directly and need no providers.
 */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  FakePdfViewer,
  getFakePdfViewerLastPassword,
  getFakePdfViewerLastUri,
  getFakePdfViewerMountCount,
  setFakePdfViewerBehavior,
} from '@/services/pdfviewer/testing/fakes';

import { ReceiptViewerView, type ReceiptViewerViewProps } from './ReceiptViewerView';

// Obviously-fake placeholder uri only (CLAUDE.md §6).
const FAKE_URI = 'file:///fake/cache/Print/recibo-1.pdf';

const FAILURE_COPY =
  'No se pudo mostrar el recibo. Vuelve a generarlo desde el historial de nóminas.';

const PROTECTED_FAILURE_COPY =
  'No se pudo abrir el recibo protegido. Vuelve a generarlo desde el historial de nóminas.';

const baseProps: ReceiptViewerViewProps = {
  PdfViewer: FakePdfViewer,
  uri: FAKE_URI,
  awaitingPassword: false,
  protectedReceipt: false,
  pdfState: 'loaded',
  onPdfLoad: () => {},
  onPdfFailure: () => {},
  onShare: () => {},
  onSendMail: () => {},
  shareEnabled: true,
  mailEnabled: true,
  mailHint: null,
  dispatchStatus: 'idle',
  dispatchError: null,
};

async function renderView(props: ReceiptViewerViewProps): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ReceiptViewerView {...props} />);
  });
  return renderer;
}

function find(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

function has(renderer: ReactTestRenderer, testID: string): boolean {
  return renderer.root.findAllByProps({ testID }).length > 0;
}

describe('ReceiptViewerView', () => {
  beforeEach(() => {
    setFakePdfViewerBehavior({ kind: 'pending' });
  });

  it('shows the Spanish loading text and disables both actions while loading', async () => {
    const renderer = await renderView({ ...baseProps, pdfState: 'loading' });

    expect(find(renderer, 'receipt-viewer-loading').props.children).toBe('Cargando recibo…');
    expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(true);
    expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(true);
  });

  it('mounts the injected viewer with the uri while loading', async () => {
    await renderView({ ...baseProps, pdfState: 'loading' });

    expect(getFakePdfViewerLastUri()).toBe(FAKE_URI);
    expect(getFakePdfViewerMountCount()).toBe(1);
  });

  it('hides the loading text and enables both actions once loaded', async () => {
    const renderer = await renderView(baseProps);

    expect(has(renderer, 'receipt-viewer-loading')).toBe(false);
    expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(false);
    expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(false);
    expect(getFakePdfViewerMountCount()).toBe(1);
  });

  it('forwards the viewer callbacks to the injected viewer', async () => {
    const onPdfLoad = jest.fn();
    const onPdfFailure = jest.fn();
    setFakePdfViewerBehavior({ kind: 'loaded', pageCount: 2 });
    await renderView({ ...baseProps, pdfState: 'loading', onPdfLoad, onPdfFailure });

    expect(onPdfLoad).toHaveBeenCalledWith(2);
    expect(onPdfFailure).not.toHaveBeenCalled();
  });

  it('shows the exact failure copy, no action bar and no viewer when failed', async () => {
    const renderer = await renderView({ ...baseProps, pdfState: 'failed' });

    expect(find(renderer, 'receipt-viewer-failed').props.children).toBe(FAILURE_COPY);
    expect(has(renderer, 'receipt-viewer-loading')).toBe(false);
    expect(has(renderer, 'receipt-viewer-share')).toBe(false);
    expect(has(renderer, 'receipt-viewer-send')).toBe(false);
    expect(getFakePdfViewerMountCount()).toBe(0);
  });

  it('treats a null uri as failed without mounting the viewer', async () => {
    const renderer = await renderView({ ...baseProps, uri: null, pdfState: 'loading' });

    expect(find(renderer, 'receipt-viewer-failed').props.children).toBe(FAILURE_COPY);
    expect(has(renderer, 'receipt-viewer-share')).toBe(false);
    expect(getFakePdfViewerMountCount()).toBe(0);
  });

  it('fires onShare and onSendMail when the actions are pressed', async () => {
    const onShare = jest.fn();
    const onSendMail = jest.fn();
    const renderer = await renderView({ ...baseProps, onShare, onSendMail });

    await act(async () => {
      find(renderer, 'receipt-viewer-share').props.onPress();
      find(renderer, 'receipt-viewer-send').props.onPress();
    });

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onSendMail).toHaveBeenCalledTimes(1);
  });

  it('disables only "Compartir" when sharing is not enabled', async () => {
    const renderer = await renderView({ ...baseProps, shareEnabled: false });

    expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(true);
    expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(false);
  });

  it('disables only "Enviar por correo" and shows the hint when mail is not enabled', async () => {
    const renderer = await renderView({
      ...baseProps,
      mailEnabled: false,
      mailHint: 'No se encontró la nómina de este recibo.',
    });

    expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(true);
    expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(false);
    expect(find(renderer, 'receipt-viewer-mail-hint').props.children).toBe(
      'No se encontró la nómina de este recibo.',
    );
  });

  it('shows no hint when mailHint is null', async () => {
    const renderer = await renderView(baseProps);

    expect(has(renderer, 'receipt-viewer-mail-hint')).toBe(false);
  });

  it('disables both actions while sharing or sending', async () => {
    for (const dispatchStatus of ['sharing', 'sending'] as const) {
      const renderer = await renderView({ ...baseProps, dispatchStatus });

      expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(true);
      expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(true);
    }
  });

  it('shows the Spanish sent confirmation when dispatchStatus is "sent"', async () => {
    const renderer = await renderView({ ...baseProps, dispatchStatus: 'sent' });

    expect(find(renderer, 'receipt-viewer-dispatch-sent').props.children).toBe('Recibo enviado.');
  });

  it('shows the dispatch error when dispatchStatus is "failed"', async () => {
    const renderer = await renderView({
      ...baseProps,
      dispatchStatus: 'failed',
      dispatchError: 'No se pudo compartir el recibo.',
    });

    expect(find(renderer, 'receipt-viewer-dispatch-failed').props.children).toBe(
      'No se pudo compartir el recibo.',
    );
  });

  it('renders nothing extra when dispatchStatus is "cancelled" (neutral)', async () => {
    const renderer = await renderView({ ...baseProps, dispatchStatus: 'cancelled' });

    expect(has(renderer, 'receipt-viewer-dispatch-sent')).toBe(false);
    expect(has(renderer, 'receipt-viewer-dispatch-failed')).toBe(false);
  });

  describe('protected receipts (spec R10)', () => {
    it('passes the password to the injected viewer (S1)', async () => {
      await renderView({ ...baseProps, protectedReceipt: true, password: '00000000T', pdfState: 'loading' });

      expect(getFakePdfViewerMountCount()).toBe(1);
      expect(getFakePdfViewerLastPassword()).toBe('00000000T');
    });

    it('passes no password for a plain receipt (S3)', async () => {
      await renderView({ ...baseProps, pdfState: 'loading' });

      expect(getFakePdfViewerMountCount()).toBe(1);
      expect(getFakePdfViewerLastPassword()).toBeNull();
    });

    it('does not mount the viewer while the password is being derived, and keeps both actions disabled', async () => {
      const renderer = await renderView({
        ...baseProps,
        protectedReceipt: true,
        awaitingPassword: true,
        pdfState: 'loading',
      });

      expect(getFakePdfViewerMountCount()).toBe(0);
      expect(find(renderer, 'receipt-viewer-loading').props.children).toBe('Cargando recibo…');
      expect(find(renderer, 'receipt-viewer-share').props.disabled).toBe(true);
      expect(find(renderer, 'receipt-viewer-send').props.disabled).toBe(true);
    });

    it('shows the protected failure copy instead of the plain one when a protected receipt fails (S2)', async () => {
      const renderer = await renderView({ ...baseProps, protectedReceipt: true, pdfState: 'failed' });

      expect(find(renderer, 'receipt-viewer-failed').props.children).toBe(PROTECTED_FAILURE_COPY);
      expect(has(renderer, 'receipt-viewer-share')).toBe(false);
      expect(getFakePdfViewerMountCount()).toBe(0);
    });

    it('keeps the plain failure copy for a plain receipt', async () => {
      const renderer = await renderView({ ...baseProps, pdfState: 'failed' });

      expect(find(renderer, 'receipt-viewer-failed').props.children).toBe(FAILURE_COPY);
    });
  });
});
