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

export function PdfViewerView({ uri, onLoad, onFailure, testID }: PdfViewerProps) {
  return (
    <View className="flex-1" testID={testID}>
      <Pdf
        // `cache: true` is load-bearing: when `cache` is falsy the library
        // unlinks its resolved file on unmount, which for a `file://` source
        // may be the generated receipt itself. That would break a later
        // "Compartir" / "Enviar por correo" from the history banner.
        source={{ uri, cache: true }}
        // We never download; the library default (`true`) would trust any cert.
        trustAllCerts={false}
        // Fit width suits a portrait page on a phone.
        fitPolicy={0}
        spacing={8}
        enablePaging={false}
        // Suppress the library's percentage text so the screen owns the single
        // Spanish loading state.
        renderActivityIndicator={() => <View />}
        onLoadComplete={(numberOfPages) => onLoad(numberOfPages)}
        // Never forward the library's error object or message text (design ADR-3).
        onError={() => onFailure('load_failed')}
        style={{ flex: 1 }}
      />
    </View>
  );
}
