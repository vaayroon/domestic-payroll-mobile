import { act } from 'react-test-renderer';

import { i18n } from './src/core/i18n/i18n';

// A test that switches the UI to English must not leak into the next one.
// Mounted renderers re-render on the language event, hence the act() wrapper.
afterEach(async () => {
  if (i18n.language !== 'es') {
    await act(async () => {
      await i18n.changeLanguage('es');
    });
  }
});
