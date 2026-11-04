import { i18n } from './src/core/i18n/i18n';

// A test that switches the UI to English must not leak into the next one.
afterEach(async () => {
  if (i18n.language !== 'es') {
    await i18n.changeLanguage('es');
  }
});
