/**
 * Render test for `PdfViewerProvider` / `usePdfViewer` (design ADR-4).
 */

import { Component, type ReactNode } from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import type { PdfViewerProps } from '@/types';

import { PdfViewerProvider, usePdfViewer, type PdfViewerComponent } from './PdfViewerProvider';

function StubViewer({ uri }: PdfViewerProps) {
  return <Text>{`stub:${uri}`}</Text>;
}

function Consumer({ onResolve }: { onResolve: (viewer: PdfViewerComponent) => void }) {
  const Viewer = usePdfViewer();
  onResolve(Viewer);
  return <Viewer uri="file:///a.pdf" onLoad={() => undefined} onFailure={() => undefined} />;
}

/** Error boundary that records render errors instead of letting React rethrow them. */
class ErrorCatcher extends Component<
  { onError: (error: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

describe('PdfViewerProvider', () => {
  it('returns the injected component', async () => {
    const onResolve = jest.fn();
    await act(async () => {
      create(
        <PdfViewerProvider viewer={StubViewer}>
          <Consumer onResolve={onResolve} />
        </PdfViewerProvider>,
      );
    });
    expect(onResolve).toHaveBeenCalledWith(StubViewer);
  });

  it('throws when usePdfViewer is called outside the provider', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const caught: Error[] = [];
    try {
      await act(async () => {
        create(
          <ErrorCatcher onError={(error) => caught.push(error)}>
            <Consumer onResolve={() => undefined} />
          </ErrorCatcher>,
        );
      });
    } finally {
      consoleError.mockRestore();
    }
    expect(caught).toHaveLength(1);
    expect(caught[0]?.message).toBe('usePdfViewer must be called within a <PdfViewerProvider>.');
  });
});
