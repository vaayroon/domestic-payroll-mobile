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
    // on the hand-written repository interfaces in src/types.
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['drizzle-orm', 'drizzle-orm/*'],
              message: 'Drizzle is only allowed inside src/services/db/. Depend on the repository interfaces in src/types instead.',
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
]);
