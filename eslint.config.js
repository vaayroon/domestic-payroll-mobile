// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Drizzle is an infrastructure detail of the persistence layer. Keep it
    // fully contained inside services/db/ so features/core only ever depend
    // on the hand-written repository interfaces in src/types. Same rationale
    // for expo-print: it is only allowed inside services/pdf/, sealed behind
    // the ReceiptPdfGenerator interface (design ADR-2).
    //
    // Receipt encryption (design D1/D3) adds three more things that exist only
    // inside services/pdf/: the pure-JS PDF writer `@cantoo/pdf-lib`,
    // `expo-file-system` (the plain PDF bytes are read and rewritten there and
    // must never be reachable from features/core), and the secure RANDOM-BYTES
    // API of `expo-crypto`. `expo-crypto` itself is NOT sealed package-wide:
    // `src/app/_layout.tsx` legitimately imports `randomUUID`, so only the
    // functions that feed the encryption shim are restricted, by `importNames`.
    rules: {
      // core/ and the feature slices import each other's barrels; a barrel that
      // re-exports screens can close a loop back into @/core (it happened twice
      // with ReminderProvider). Fail the lint instead of a runtime warning.
      'import/no-cycle': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-crypto',
              importNames: ['getRandomValues', 'getRandomBytes', 'getRandomBytesAsync'],
              message: 'The expo-crypto random-bytes API is only allowed inside src/services/pdf/ (secure-random shim for receipt encryption). randomUUID stays free to use.',
            },
            {
              // Android is edge-to-edge (Expo SDK 54): a plain ScrollView or RN's
              // KeyboardAvoidingView leaves inputs behind the keyboard.
              name: 'react-native',
              importNames: ['ScrollView', 'KeyboardAvoidingView'],
              message: 'Use FormScrollView from @/core: it keeps inputs and the submit button above the Android keyboard. Lists without inputs use FlatList.',
            },
          ],
          patterns: [
            {
              group: ['drizzle-orm', 'drizzle-orm/*'],
              message: 'Drizzle is only allowed inside src/services/db/. Depend on the repository interfaces in src/types instead.',
            },
            {
              group: ['expo-print', 'expo-print/*'],
              message: 'expo-print is only allowed inside src/services/pdf/. Depend on the ReceiptPdfGenerator interface in src/types instead.',
            },
            {
              group: ['@cantoo/pdf-lib', '@cantoo/pdf-lib/*', 'expo-file-system', 'expo-file-system/*'],
              message: '@cantoo/pdf-lib/expo-file-system are only allowed inside src/services/pdf/. Depend on the ReceiptPdfGenerator interface in src/types instead.',
            },
            {
              group: [
                '@/services/pdf/secureRandom',
                '@/services/pdf/encryptPdfBytes',
                '**/pdf/secureRandom',
                '**/pdf/encryptPdfBytes',
              ],
              message: 'secureRandom/encryptPdfBytes are adapter-internal to src/services/pdf/. Depend on the ReceiptPdfGenerator interface in src/types instead.',
            },
            {
              group: ['expo-sharing', 'expo-sharing/*', 'expo-mail-composer', 'expo-mail-composer/*'],
              message: 'expo-sharing/expo-mail-composer are only allowed inside src/services/mail/. Depend on the PdfSharer/MailSender interfaces in src/types instead.',
            },
            {
              group: ['expo-notifications', 'expo-notifications/*'],
              message: 'expo-notifications is only allowed inside src/services/notify/. Depend on the NotificationScheduler interface in src/types instead.',
            },
            {
              group: ['react-native-signature-canvas', 'react-native-signature-canvas/*', 'react-native-webview', 'react-native-webview/*'],
              message: 'react-native-signature-canvas/react-native-webview are only allowed inside src/services/signature/. Depend on the SignaturePadProps contract in src/types instead.',
            },
            {
              group: ['react-native-pdf', 'react-native-pdf/*', 'react-native-blob-util', 'react-native-blob-util/*'],
              message: 'react-native-pdf/react-native-blob-util are only allowed inside src/services/pdfviewer/. Depend on the PdfViewerProps contract in src/types instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/services/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/services/pdf/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/services/mail/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/services/notify/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/services/signature/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/services/pdfviewer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);
