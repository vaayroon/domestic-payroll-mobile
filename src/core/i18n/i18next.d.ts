import 'i18next';

import type { es } from './locales/es';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof es };
    // Selector API: t(($) => $.common.dateHint). Keys are checked by tsc.
    enableSelector: true;
    returnNull: false;
  }
}
