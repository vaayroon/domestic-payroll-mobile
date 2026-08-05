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
    rules: {
      'no-restricted-imports': [
        'error',
        {
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
              group: ['expo-sharing', 'expo-sharing/*', 'expo-mail-composer', 'expo-mail-composer/*'],
              message: 'expo-sharing/expo-mail-composer are only allowed inside src/services/mail/. Depend on the PdfSharer/MailSender interfaces in src/types instead.',
            },
            {
              group: ['expo-notifications', 'expo-notifications/*'],
              message: 'expo-notifications is only allowed inside src/services/notify/. Depend on the NotificationScheduler interface in src/types instead.',
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
]);
