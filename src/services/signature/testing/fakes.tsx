/**
 * In-memory `SignaturePadProps` fake for unit tests (design ADR-7). Real
 * `react-native-signature-canvas` renders a `WebView`, which cannot run
 * under `jest-expo` headless. Screens are exercised against this fake
 * through `<SignaturePadProvider>` instead (mirrors `FakeReceiptPdfGenerator`).
 *
 * Behaviour is switchable via a module-level test knob rather than extra
 * props, so the fake's own prop surface stays byte-identical to the real
 * `SignaturePadProps` contract. Reset with `setFakeSignaturePadBehavior`
 * before each test.
 */

import { useEffect } from 'react';

import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from '@/core/testing/fixtures';
import type { SignaturePadProps } from '@/types';

export type FakeSignaturePadBehavior =
  | { readonly kind: 'ready-with-signature' }
  | { readonly kind: 'ready-empty' }
  | { readonly kind: 'load-failed' }
  | { readonly kind: 'capture-failed' };

let behavior: FakeSignaturePadBehavior = { kind: 'ready-with-signature' };
let clearCallCount = 0;

export function setFakeSignaturePadBehavior(next: FakeSignaturePadBehavior): void {
  behavior = next;
  clearCallCount = 0;
}

/** How many times the screen invoked `controls.clear()` since the last reset. */
export function getFakeSignaturePadClearCount(): number {
  return clearCallCount;
}

export function FakeSignaturePad({ onReady, onCapture, onEmpty, onFailure }: SignaturePadProps) {
  useEffect(() => {
    if (behavior.kind === 'load-failed') {
      onFailure('load_failed');
      return;
    }

    onReady({
      capture: () => {
        if (behavior.kind === 'ready-empty') {
          onEmpty();
        } else if (behavior.kind === 'capture-failed') {
          onFailure('capture_failed');
        } else {
          onCapture(SYNTHETIC_SIGNATURE_PNG_BASE64);
        }
      },
      clear: () => {
        // Canvas-only in the real adapter; the fake has no canvas state to
        // clear, so it just records the call for assertions.
        clearCallCount += 1;
      },
    });
    // Fires once on mount, mirroring the real adapter's `onLoadEnd` -> `onReady` timing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
