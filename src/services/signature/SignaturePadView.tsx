/**
 * Sealed native signature-capture adapter (design ADR-1/ADR-2/ADR-6). The
 * ONLY file allowed to import `react-native-signature-canvas` /
 * `react-native-webview` (eslint-enforced -- see `eslint.config.js`).
 * Wraps the library behind the domain-free `SignaturePadProps` contract in
 * `@/types`; callers never see the library's own types.
 *
 * Fixed-height `<View>` wrapper: a heightless WebView collapses to zero on
 * Android (design ADR-2). `clearSignature()` is a confirmed real ref method
 * (Context7-verified) -- no key-bump remount fallback is needed.
 */

import { useRef, useState } from 'react';
import { View } from 'react-native';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';

import type { SignaturePadProps } from '@/types';

const DATA_URL_PREFIX = 'data:image/png;base64,';

/** Explicit, never relying on the library's undocumented default (design ADR-2). */
const TRANSPARENT_BACKGROUND = 'rgba(255,255,255,0)';

export function SignaturePadView({
  initialPngBase64,
  heightPx,
  penColor,
  onReady,
  onCapture,
  onEmpty,
  onFailure,
  testID,
}: SignaturePadProps) {
  const ref = useRef<SignatureViewRef>(null);
  const [loaded, setLoaded] = useState(false);

  const handleOk = (dataUrl: string) => {
    if (!dataUrl.startsWith(DATA_URL_PREFIX)) {
      onFailure('capture_failed');
      return;
    }
    onCapture(dataUrl.slice(DATA_URL_PREFIX.length));
  };

  const handleLoadEnd = () => {
    setLoaded(true);
    onReady({
      capture: () => ref.current?.readSignature(),
      clear: () => ref.current?.clearSignature(),
    });
  };

  const handleError = () => {
    // Never forward the library's raw error object or message text (design ADR-6).
    onFailure(loaded ? 'capture_failed' : 'load_failed');
  };

  return (
    <View style={{ height: heightPx }} testID={testID}>
      <SignatureCanvas
        ref={ref}
        imageType="image/png"
        backgroundColor={TRANSPARENT_BACKGROUND}
        trimWhitespace
        penColor={penColor}
        dataURL={initialPngBase64 === null ? undefined : `${DATA_URL_PREFIX}${initialPngBase64}`}
        onOK={handleOk}
        onEmpty={onEmpty}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />
    </View>
  );
}
