/**
 * In-memory `PdfViewerProps` fake for unit tests (design "Fake"). The real
 * `react-native-pdf` view needs the native PDF renderer and cannot run under
 * `jest-expo` headless. Screens are exercised against this fake through
 * `<PdfViewerProvider>` instead (mirrors `FakeSignaturePad`).
 *
 * Behaviour is switchable via a module-level test knob rather than extra
 * props, so the fake's own prop surface stays byte-identical to the real
 * `PdfViewerProps` contract. Reset with `setFakePdfViewerBehavior` before
 * each test.
 *
 * Tests MUST import this file directly, never the `@/services/pdfviewer`
 * barrel: the barrel re-exports the real view, which loads the native module.
 */

import { useEffect } from 'react';

import type { PdfViewerProps } from '@/types';

export type FakePdfViewerBehavior =
  | { readonly kind: 'loaded'; readonly pageCount: number }
  | { readonly kind: 'error' }
  | { readonly kind: 'pending' };

const DEFAULT_BEHAVIOR: FakePdfViewerBehavior = { kind: 'loaded', pageCount: 1 };

let behavior: FakePdfViewerBehavior = DEFAULT_BEHAVIOR;
let lastUri: string | null = null;
let mountCount = 0;

/** Sets the behaviour and resets the recorded uri and mount count. */
export function setFakePdfViewerBehavior(next: FakePdfViewerBehavior): void {
  behavior = next;
  lastUri = null;
  mountCount = 0;
}

/** The uri of the most recent mount since the last reset; `null` if never mounted. */
export function getFakePdfViewerLastUri(): string | null {
  return lastUri;
}

/** How many times the fake mounted since the last reset. */
export function getFakePdfViewerMountCount(): number {
  return mountCount;
}

export function FakePdfViewer({ uri, onLoad, onFailure }: PdfViewerProps) {
  useEffect(() => {
    lastUri = uri;
    mountCount += 1;

    if (behavior.kind === 'loaded') {
      onLoad(behavior.pageCount);
    } else if (behavior.kind === 'error') {
      onFailure('load_failed');
    }
    // `pending` deliberately fires nothing, for loading-state tests.
    // Fires once on mount, mirroring the real adapter's `onLoadComplete` timing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
