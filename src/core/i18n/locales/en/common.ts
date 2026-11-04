import type { Catalog } from '../../catalog';
import type { common as es } from '../es/common';

export const common: Catalog<typeof es> = {
  months: {
    m1: 'January',
    m2: 'February',
    m3: 'March',
    m4: 'April',
    m5: 'May',
    m6: 'June',
    m7: 'July',
    m8: 'August',
    m9: 'September',
    m10: 'October',
    m11: 'November',
    m12: 'December',
  },
  monthYear: '{{month}} {{year}}',
  dateHint: 'YYYY-MM-DD',
};
