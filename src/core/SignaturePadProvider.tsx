/**
 * DI composition boundary for the native signature-capture surface (design
 * ADR-1/ADR-2). Mirrors `PdfServiceProvider.tsx`'s pattern: imports
 * exclusively from `@/types`, never `react-native-signature-canvas` or
 * `react-native-webview` directly; the concrete `SignaturePadView` is
 * constructed once at the composition root (`src/app/_layout.tsx`) and
 * handed to `<SignaturePadProvider>` as a prop.
 */

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

import type { SignaturePadProps } from '@/types';

export type SignaturePadComponent = ComponentType<SignaturePadProps>;

const SignaturePadContext = createContext<SignaturePadComponent | null>(null);

export function SignaturePadProvider({
  pad,
  children,
}: {
  pad: SignaturePadComponent;
  children: ReactNode;
}) {
  return <SignaturePadContext.Provider value={pad}>{children}</SignaturePadContext.Provider>;
}

export function useSignaturePad(): SignaturePadComponent {
  const pad = useContext(SignaturePadContext);
  if (!pad) {
    throw new Error('useSignaturePad must be called within a <SignaturePadProvider>.');
  }
  return pad;
}
