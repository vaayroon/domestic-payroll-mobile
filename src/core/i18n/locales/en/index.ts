import type { Catalog } from '../../catalog';
import type { es } from '../es';
import { common } from './common';

export const en: Catalog<typeof es> = { common };
