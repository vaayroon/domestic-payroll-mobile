/**
 * DI composition boundary for the native PDF-viewing surface (design ADR-4).
 * Mirrors `SignaturePadProvider.tsx`: imports exclusively from `@/types`,
 * never `react-native-pdf` or `react-native-blob-util` directly; the concrete
 * `PdfViewerView` is handed to `<PdfViewerProvider>` as a prop at the
 * composition root (`src/app/_layout.tsx`).
 */

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

import type { PdfViewerProps } from '@/types';

export type PdfViewerComponent = ComponentType<PdfViewerProps>;

const PdfViewerContext = createContext<PdfViewerComponent | null>(null);

export function PdfViewerProvider({
  viewer,
  children,
}: {
  viewer: PdfViewerComponent;
  children: ReactNode;
}) {
  return <PdfViewerContext.Provider value={viewer}>{children}</PdfViewerContext.Provider>;
}

export function usePdfViewer(): PdfViewerComponent {
  const viewer = useContext(PdfViewerContext);
  if (!viewer) {
    throw new Error('usePdfViewer must be called within a <PdfViewerProvider>.');
  }
  return viewer;
}
