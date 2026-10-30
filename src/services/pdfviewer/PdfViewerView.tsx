/**
 * Sealed native PDF viewer adapter (design ADR-1/ADR-3). The ONLY file
 * allowed to import `react-native-pdf` / `react-native-blob-util`
 * (eslint-enforced -- see `eslint.config.js`). Wraps the library behind the
 * domain-free `PdfViewerProps` contract in `@/types`; callers never see the
 * library's own types.
 *
 * Fills its parent (`flex-1`); the caller sizes the container. Not
 * unit-tested: the native renderer cannot run under jest, so this file is
 * covered by device QA only (design "Testing strategy").
 */

import { View } from 'react-native';
import Pdf from 'react-native-pdf';

import type { PdfViewerProps } from '@/types';

/** `react-native-pdf` fitPolicy: 0 = fit width, 1 = fit height, 2 = fit both (library README). */
const FIT_POLICY_WIDTH = 0;

export function PdfViewerView({ uri, password, onLoad, onFailure, testID }: PdfViewerProps) {
  return (
    <View className="flex-1" testID={testID}>
      <Pdf
        // Defensive: with `cache` falsy some library versions may unlink their
        // resolved file on unmount, which for a `file://` source could be the
        // generated receipt. The installed 7.0.5 does not delete `file://`
        // sources either way (only its own downloaded cache copy). Re-check
        // this on version bumps.
        source={{ uri, cache: true }}
        // Encrypted receipts only; the library default is '' (no password).
        password={password}
        // We never download; the library default (`true`) would trust any cert.
        trustAllCerts={false}
        // Fit width suits a portrait page on a phone.
        fitPolicy={FIT_POLICY_WIDTH}
        spacing={8}
        enablePaging={false}
        // Suppress the library's percentage text so the screen owns the single
        // Spanish loading state.
        renderActivityIndicator={() => <View />}
        onLoadComplete={(numberOfPages) => onLoad(numberOfPages)}
        // Never forward the library's error object or message text (design ADR-3).
        onError={() => onFailure('load_failed')}
        // Inline style on purpose: `Pdf` is a third-party component that takes a
        // `style` prop, not NativeWind classes.
        style={{ flex: 1 }}
      />
    </View>
  );
}
