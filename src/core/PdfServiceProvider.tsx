/**
 * DI composition boundary for the PDF engine (design ADR-2). Mirrors
 * `RepositoryProvider.tsx`'s pattern but is deliberately a SIBLING provider,
 * not folded into `Repositories` — a PDF generator is not a repository and
 * would pollute that persistence-only abstraction. Imports exclusively from
 * `@/types`, never `expo-print` directly; the concrete
 * `ExpoPrintReceiptGenerator` is constructed once at the composition root
 * (`src/app/_layout.tsx`) and handed to `<PdfServiceProvider>` as a prop.
 */

import { createContext, useContext, type ReactNode } from 'react';

import type { ReceiptPdfGenerator } from '@/types';

const PdfServiceContext = createContext<ReceiptPdfGenerator | null>(null);

export function PdfServiceProvider({
  generator,
  children,
}: {
  generator: ReceiptPdfGenerator;
  children: ReactNode;
}) {
  return <PdfServiceContext.Provider value={generator}>{children}</PdfServiceContext.Provider>;
}

export function usePdfGenerator(): ReceiptPdfGenerator {
  const generator = useContext(PdfServiceContext);
  if (!generator) {
    throw new Error('usePdfGenerator must be called within a <PdfServiceProvider>.');
  }
  return generator;
}
